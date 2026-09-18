/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Octokit } from '@octokit/core';

const __filename = fileURLToPath(import.meta.url);

/**
 * Marker embedded in comments posted by this workflow; used to find and clean
 * up stale validation-failure comments on later runs.
 */
export const COMMENT_MARKER = '<!-- update-translations:locales-validation-failure -->';

// The report file name is fixed: validate_locales.ts removes stale reports
// before writing, so at most one report exists in the repo root at a time.
const REPORT_FILE_NAME = 'report_locales_error.md';
// GitHub comment body limit is 65536 characters; keep the tail of the report.
const MAX_REPORT_LENGTH = 60000;
// GitHub's maximum number of items per page.
const COMMENTS_PER_PAGE = 100;

/**
 * Outcome of the locales validation step in the workflow.
 */
export type ValidationResult = 'failure' | 'success';

interface Comment {
    id: number;
    body: string;
    // The GitHub API reports 'Bot' for comments posted by the workflow's
    // GITHUB_TOKEN (github-actions[bot]) and 'User' for human authors.
    user: { type: string } | null;
}

/**
 * Checks whether a comment was posted by this workflow.
 *
 * The body must start with the workflow marker (buildCommentBody always places
 * it first) and the author must be a bot account. Requiring both keeps the
 * stale-comment cleanup from deleting a maintainer's quote reply: quoting
 * copies the marker into the body, but the author type stays 'User'.
 *
 * @param comment - Comment to check.
 * @returns True when the comment was posted by this workflow.
 */
export const isValidationComment = (comment: Pick<Comment, 'body' | 'user'>): boolean => {
    return comment.user?.type === 'Bot' && comment.body.startsWith(COMMENT_MARKER);
};

/**
 * Truncates the report to the maximum safe comment length, keeping the tail.
 *
 * @param report - The validation report content.
 * @returns The report, truncated at the end when too long.
 */
export const truncateReport = (report: string): string => {
    if (report.length <= MAX_REPORT_LENGTH) {
        return report;
    }
    return `... (truncated) ...\n${report.slice(-MAX_REPORT_LENGTH)}`;
};

/**
 * Builds the comment body for a validation failure.
 *
 * @param report - The validation report content (may be empty).
 * @returns The full comment body, including the workflow marker.
 */
export const buildCommentBody = (report: string): string => {
    const truncatedReport = truncateReport(report);
    return [
        COMMENT_MARKER,
        '**`yarn validate:locales` failed** for the downloaded translations.',
        'The PR was created anyway so the changes can be inspected and fixed.',
        '',
        '<details><summary>Validation report</summary>',
        '',
        truncatedReport || 'No validation report was captured.',
        '',
        '</details>',
    ].join('\n');
};

/**
 * Reads the validation report from the given directory.
 *
 * @param dir - Directory to scan for the report file.
 * @returns The report content, or an empty string when no report exists.
 */
export const readReport = (dir: string): string => {
    const reportPath = path.join(dir, REPORT_FILE_NAME);
    if (!fs.existsSync(reportPath)) {
        return '';
    }
    return fs.readFileSync(reportPath, 'utf8').trim();
};

/**
 * Extracts the URL of the next results page from a Link header.
 *
 * @param linkHeader - The raw Link header value, or null when absent.
 * @returns The next page URL, or null when there is no next page.
 */
export const getNextPageUrl = (linkHeader: string | null): string | null => {
    if (!linkHeader) {
        return null;
    }
    const nextLink = linkHeader.split(',').find((part) => part.includes('rel="next"'));
    if (!nextLink) {
        return null;
    }
    const urlMatch = nextLink.match(/<([^>]+)>/);
    return urlMatch ? urlMatch[1] : null;
};

/**
 * GitHub REST API client used to manage PR comments, backed by Octokit.
 */
export class GitHubClient {
    private readonly owner: string;

    private readonly repo: string;

    private readonly octokit: Octokit;

    /**
     * Creates a client for the given repository.
     *
     * @param octokit - Octokit instance, e.g. authenticated with a token.
     * @param repo - Repository in `owner/repo` form.
     */
    constructor(octokit: Octokit, repo: string) {
        [this.owner, this.repo] = repo.split('/');
        this.octokit = octokit;
    }

    /**
     * Lists all comments on an issue or pull request, following pagination.
     *
     * @param issueNumber - Issue or pull request number.
     * @returns The list of comments.
     */
    async listComments(issueNumber: number): Promise<Comment[]> {
        return this.collectCommentPages(issueNumber, 1, []);
    }

    /**
     * Collects comment pages recursively until the pagination chain ends.
     *
     * @param issueNumber - Issue or pull request number.
     * @param page - Page number to fetch.
     * @param comments - Comments collected so far.
     * @returns The full list of comments.
     */
    private async collectCommentPages(
        issueNumber: number,
        page: number,
        comments: Comment[],
    ): Promise<Comment[]> {
        const response = await this.octokit.request(
            'GET /repos/{owner}/{repo}/issues/{issue_number}/comments',
            {
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber,
                per_page: COMMENTS_PER_PAGE,
                page,
            },
        );
        comments.push(...response.data.map((comment) => ({
            id: Number(comment.id),
            body: comment.body ?? '',
            user: comment.user ? { type: comment.user.type } : null,
        })));
        const nextUrl = getNextPageUrl(response.headers.link ?? null);
        return nextUrl ? this.collectCommentPages(issueNumber, page + 1, comments) : comments;
    }

    /**
     * Deletes a comment.
     *
     * @param commentId - ID of the comment to delete.
     */
    async deleteComment(commentId: number): Promise<void> {
        await this.octokit.request(
            'DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}',
            {
                owner: this.owner,
                repo: this.repo,
                comment_id: commentId,
            },
        );
    }

    /**
     * Creates a comment on an issue or pull request.
     *
     * @param issueNumber - Issue or pull request number.
     * @param body - Comment body.
     * @returns The id of the created comment.
     */
    async createComment(issueNumber: number, body: string): Promise<number> {
        const response = await this.octokit.request(
            'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
            {
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber,
                body,
            },
        );
        return Number(response.data.id);
    }
}

export interface ReportValidationOptions {
    /** Number of the translations pull request. */
    prNumber: number;
    /** Outcome of the locales validation step. */
    result: ValidationResult;
    /** Directory to scan for the validation report; defaults to the cwd. */
    repoRoot?: string;
    /** GitHub API client; defaults to one built from the environment. */
    client?: GitHubClient;
}

/**
 * Builds the default GitHub API client from the workflow environment.
 *
 * @returns A client configured with GITHUB_TOKEN and GITHUB_REPOSITORY.
 */
const buildDefaultClient = (): GitHubClient => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        throw new Error('GITHUB_TOKEN environment variable is required');
    }
    const repo = process.env.GITHUB_REPOSITORY;
    if (!repo) {
        throw new Error('GITHUB_REPOSITORY environment variable is required');
    }
    return new GitHubClient(new Octokit({ auth: token }), repo);
};

/**
 * Refreshes the validation comment on the translations pull request.
 *
 * On failure a fresh comment with the latest report is posted; stale comments
 * posted by previous runs are always removed best-effort, so a fixed
 * translation run does not leave outdated failure reminders on the PR.
 *
 * @param options - PR number, validation outcome and optional overrides.
 */
export const reportValidation = async (options: ReportValidationOptions): Promise<void> => {
    const {
        prNumber,
        result,
        repoRoot = process.cwd(),
        client = buildDefaultClient(),
    } = options;

    // Post the fresh report before cleaning up stale comments, so that a
    // transient API error during cleanup cannot leave the PR without a report.
    // The fresh comment is excluded from cleanup below: GET returns it too, and
    // deleting every marked comment would remove the report we just posted.
    let freshCommentId: number | null = null;
    if (result === 'failure') {
        const report = readReport(repoRoot);
        freshCommentId = await client.createComment(prNumber, buildCommentBody(report));
    }

    // Cleanup is best-effort: failures while listing or deleting comments are
    // caught and logged (the workflow step also has continue-on-error), so a
    // single failed request cannot fail an otherwise successful run.
    let comments: Comment[] = [];
    try {
        comments = await client.listComments(prNumber);
    } catch (error) {
        console.error('Failed to list comments for cleanup:', error);
    }
    const staleComments = comments.filter(
        (comment) => comment.id !== freshCommentId && isValidationComment(comment),
    );
    const deletions = await Promise.allSettled(
        staleComments.map((comment) => client.deleteComment(comment.id)),
    );
    deletions.forEach((outcome, index) => {
        if (outcome.status === 'rejected') {
            console.error(
                `Failed to delete stale comment ${staleComments[index].id}:`,
                outcome.reason,
            );
        }
    });
};

interface CliArgs {
    prNumber: number;
    result: ValidationResult;
}

/**
 * Parses command line arguments.
 *
 * @param argv - Process arguments.
 * @returns Parsed arguments.
 */
const parseArgs = (argv: string[]): CliArgs => {
    const prIndex = argv.indexOf('--pr-number');
    const resultIndex = argv.indexOf('--result');
    const prNumber = Number(argv[prIndex + 1]);
    const result = argv[resultIndex + 1];
    if (!Number.isInteger(prNumber) || prNumber <= 0) {
        throw new Error('--pr-number must be a positive integer');
    }
    if (result !== 'failure' && result !== 'success') {
        throw new Error("--result must be either 'failure' or 'success'");
    }
    return { prNumber, result };
};

export { parseArgs };

// Only run the command-line interface if the script is executed directly
if (process.argv[1] === __filename) {
    const args = parseArgs(process.argv);
    reportValidation({ prNumber: args.prNumber, result: args.result })
        .catch((e) => {
            console.error(e);
            process.exitCode = 1;
        });
}
