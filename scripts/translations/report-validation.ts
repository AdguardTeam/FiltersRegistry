/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

/**
 * Marker embedded in comments posted by this workflow; used to find and clean
 * up stale validation-failure comments on later runs.
 */
export const COMMENT_MARKER = '<!-- update-translations:locales-validation-failure -->';

const REPORT_FILE_PREFIX = 'report_locales_error_';
const REPORT_FILE_EXTENSION = '.md';
// GitHub comment body limit is 65536 characters; keep the tail of the report.
const MAX_REPORT_LENGTH = 60000;
const DEFAULT_API_BASE_URL = 'https://api.github.com';

/**
 * Outcome of the locales validation step in the workflow.
 */
export type ValidationResult = 'failure' | 'success';

interface Comment {
    id: number;
    body: string;
}

/**
 * Checks whether a comment body was posted by this workflow.
 *
 * @param body - Comment body to check.
 * @returns True when the body contains the workflow marker.
 */
export const isValidationComment = (body: string): boolean => body.includes(COMMENT_MARKER);

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
 * Finds the most recent validation report file in the given directory.
 *
 * Report names embed a DD-MM-YYYY_HH-MM-SS timestamp, so sorting is
 * chronological and the last entry is the most recent report.
 *
 * @param dir - Directory to scan for report files.
 * @returns The report file name, or null when no report exists.
 */
export const findLatestReportFile = (dir: string): string | null => {
    const reports = fs.readdirSync(dir)
        .filter((name) => name.startsWith(REPORT_FILE_PREFIX) && name.endsWith(REPORT_FILE_EXTENSION))
        .sort();
    return reports.length > 0 ? reports[reports.length - 1] : null;
};

/**
 * Reads the most recent validation report from the given directory.
 *
 * @param dir - Directory to scan for report files.
 * @returns The report content, or an empty string when no report exists.
 */
export const readLatestReport = (dir: string): string => {
    const reportFile = findLatestReportFile(dir);
    if (!reportFile) {
        return '';
    }
    return fs.readFileSync(path.join(dir, reportFile), 'utf8').trim();
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
 * Thin GitHub REST API client used to manage PR comments. Uses the global
 * fetch so no extra dependencies are needed.
 */
export class GitHubClient {
    private readonly baseUrl: string;

    private readonly headers: Record<string, string>;

    /**
     * Creates a client for the given repository.
     *
     * @param token - GitHub token (e.g. the workflow GITHUB_TOKEN).
     * @param repo - Repository in `owner/repo` form.
     * @param baseUrl - API base URL; overridable for testing.
     */
    constructor(
        token: string,
        private readonly repo: string,
        baseUrl: string = DEFAULT_API_BASE_URL,
    ) {
        this.baseUrl = baseUrl;
        this.headers = {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
        };
    }

    /**
     * Lists all comments on an issue or pull request, following pagination.
     *
     * @param issueNumber - Issue or pull request number.
     * @returns The list of comments.
     */
    async listComments(issueNumber: number): Promise<Comment[]> {
        const firstPageUrl = `${this.baseUrl}/repos/${this.repo}/issues/${issueNumber}/comments?per_page=100`;
        return this.collectCommentPages(firstPageUrl, []);
    }

    /**
     * Collects comment pages recursively until the pagination chain ends.
     *
     * @param url - URL of the page to fetch.
     * @param comments - Comments collected so far.
     * @returns The full list of comments.
     */
    private async collectCommentPages(url: string, comments: Comment[]): Promise<Comment[]> {
        const response = await fetch(url, {
            headers: this.headers,
        });
        if (!response.ok) {
            throw new Error(`Failed to list comments: ${response.status} ${await response.text()}`);
        }
        const page = await response.json() as Comment[];
        comments.push(...page);
        const nextUrl = getNextPageUrl(response.headers.get('link'));
        return nextUrl ? this.collectCommentPages(nextUrl, comments) : comments;
    }

    /**
     * Deletes a comment.
     *
     * @param commentId - ID of the comment to delete.
     */
    async deleteComment(commentId: number): Promise<void> {
        const response = await fetch(
            `${this.baseUrl}/repos/${this.repo}/issues/comments/${commentId}`,
            {
                method: 'DELETE',
                headers: this.headers,
            },
        );
        if (!response.ok) {
            throw new Error(`Failed to delete comment ${commentId}: ${response.status} ${await response.text()}`);
        }
    }

    /**
     * Creates a comment on an issue or pull request.
     *
     * @param issueNumber - Issue or pull request number.
     * @param body - Comment body.
     */
    async createComment(issueNumber: number, body: string): Promise<void> {
        const response = await fetch(
            `${this.baseUrl}/repos/${this.repo}/issues/${issueNumber}/comments`,
            {
                method: 'POST',
                headers: { ...this.headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    body,
                }),
            },
        );
        if (!response.ok) {
            throw new Error(`Failed to create comment: ${response.status} ${await response.text()}`);
        }
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
    return new GitHubClient(token, repo);
};

/**
 * Refreshes the validation comment on the translations pull request.
 *
 * Previous comments posted by this workflow are always removed: on failure a
 * fresh comment with the latest report is posted, on success the cleanup
 * alone ensures that a fixed translation run does not leave stale failure
 * reminders on the PR.
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

    const comments = await client.listComments(prNumber);
    const staleComments = comments.filter((comment) => isValidationComment(comment.body));
    await Promise.all(staleComments.map((comment) => client.deleteComment(comment.id)));

    if (result === 'failure') {
        const report = readLatestReport(repoRoot);
        await client.createComment(prNumber, buildCommentBody(report));
    }
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

// Only run the command-line interface if the script is executed directly
if (process.argv[1] === __filename) {
    const args = parseArgs(process.argv);
    reportValidation({ prNumber: args.prNumber, result: args.result })
        .catch((e) => {
            console.error(e);
            process.exitCode = 1;
        });
}
