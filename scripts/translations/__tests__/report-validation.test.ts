import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Octokit } from '@octokit/core';
import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import {
    buildCommentBody,
    COMMENT_MARKER,
    getNextPageUrl,
    GitHubClient,
    isValidationComment,
    parseArgs,
    readReport,
    reportValidation,
    truncateReport,
} from '../report-validation.js';

const REPORT_FILE_NAME = 'report_locales_error.md';

/**
 * Creates a mock Octokit request response with the given data and headers.
 *
 * @param data - Response body data.
 * @param headers - Extra response headers.
 * @returns An object shaped like an Octokit response.
 */
const octokitResponse = (
    data: unknown,
    headers: Record<string, string> = {},
): { data: unknown; headers: Record<string, string> } => ({
    data,
    headers,
});

/**
 * Creates a temp dir pre-populated with validation report files.
 *
 * @param reportNames - Report file names to create.
 * @returns The temp directory path.
 */
const createReportDir = (reportNames: string[]): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-validation-test-'));
    reportNames.forEach((name) => fs.writeFileSync(path.join(dir, name), `content of ${name}`));
    return dir;
};

describe('report-validation utils', () => {
    it('detects comments posted by this workflow', () => {
        expect(isValidationComment(`text ${COMMENT_MARKER} text`)).toBe(true);
        expect(isValidationComment('ordinary comment')).toBe(false);
    });

    it('truncates long reports keeping the tail', () => {
        expect(truncateReport('short report')).toBe('short report');
        const longReport = 'x'.repeat(70000);
        const truncated = truncateReport(longReport);
        expect(truncated.startsWith('... (truncated) ...\n')).toBe(true);
        expect(truncated).toHaveLength(60000 + '... (truncated) ...\n'.length);
        expect(truncated.endsWith('x'.repeat(60000))).toBe(true);
    });

    it('keeps a report of exactly the maximum length intact', () => {
        const boundaryReport = 'x'.repeat(60000);
        expect(truncateReport(boundaryReport)).toBe(boundaryReport);
    });

    it('truncates a report one character over the maximum length', () => {
        const truncated = truncateReport('x'.repeat(60001));
        expect(truncated).toHaveLength(60000 + '... (truncated) ...\n'.length);
        expect(truncated.endsWith('x'.repeat(60000))).toBe(true);
    });

    it('builds a comment body with the marker and the report', () => {
        const body = buildCommentBody('## report');
        expect(body).toContain(COMMENT_MARKER);
        expect(body).toContain('<details><summary>Validation report</summary>');
        expect(body).toContain('## report');
    });

    it('falls back to a placeholder when the report is empty', () => {
        expect(buildCommentBody('')).toContain('No validation report was captured.');
    });

    it('reads the fixed-name report file', () => {
        const dir = createReportDir([
            REPORT_FILE_NAME,
            'report_locales_error_01-01-2026_10-00-00.md',
            'unrelated.md',
        ]);
        try {
            expect(readReport(dir)).toBe('content of report_locales_error.md');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('returns an empty string when no report exists', () => {
        const dir = createReportDir(['unrelated.md']);
        try {
            expect(readReport(dir)).toBe('');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('parses the next page URL from the Link header', () => {
        expect(getNextPageUrl(
            '<https://api.github.com/repositories/1/issues?page=2>; rel="next", <https://api.github.com/repositories/1/issues?page=1>; rel="prev"',
        )).toBe('https://api.github.com/repositories/1/issues?page=2');
        expect(getNextPageUrl('<https://api.github.com/x>; rel="last"')).toBeNull();
        expect(getNextPageUrl(null)).toBeNull();
    });
});

describe('parseArgs', () => {
    it('parses valid arguments in any order', () => {
        expect(parseArgs(['node', 'report-validation.js', '--pr-number', '7', '--result', 'failure']))
            .toEqual({ prNumber: 7, result: 'failure' });
        expect(parseArgs(['node', 'report-validation.js', '--result', 'success', '--pr-number', '12']))
            .toEqual({ prNumber: 12, result: 'success' });
    });

    it('rejects a missing, non-numeric or non-positive pr number', () => {
        expect(() => parseArgs(['node', 'x', '--result', 'failure']))
            .toThrow('--pr-number must be a positive integer');
        expect(() => parseArgs(['node', 'x', '--pr-number', 'abc', '--result', 'failure']))
            .toThrow('--pr-number must be a positive integer');
        expect(() => parseArgs(['node', 'x', '--pr-number', '0', '--result', 'failure']))
            .toThrow('--pr-number must be a positive integer');
        expect(() => parseArgs(['node', 'x', '--pr-number', '1.5', '--result', 'failure']))
            .toThrow('--pr-number must be a positive integer');
    });

    it('rejects a missing or unknown result value', () => {
        expect(() => parseArgs(['node', 'x', '--pr-number', '7']))
            .toThrow("--result must be either 'failure' or 'success'");
        expect(() => parseArgs(['node', 'x', '--pr-number', '7', '--result', 'maybe']))
            .toThrow("--result must be either 'failure' or 'success'");
    });
});

describe('GitHubClient', () => {
    const requestMock = vi.fn();

    beforeEach(() => {
        requestMock.mockReset();
    });

    const client = (): GitHubClient => new GitHubClient(
        { request: requestMock } as unknown as Octokit,
        'o/r',
    );

    it('lists comments following pagination', async () => {
        requestMock
            .mockResolvedValueOnce(octokitResponse(
                [{ id: 1, body: 'first page' }],
                { link: '<https://api.github.com/repos/o/r/issues/5/comments?page=2>; rel="next"' },
            ))
            .mockResolvedValueOnce(octokitResponse([{ id: 2, body: 'second page' }]));

        const comments = await client().listComments(5);

        expect(comments).toEqual([
            { id: 1, body: 'first page' },
            { id: 2, body: 'second page' },
        ]);
        expect(requestMock).toHaveBeenCalledTimes(2);
        expect(requestMock).toHaveBeenNthCalledWith(
            1,
            'GET /repos/{owner}/{repo}/issues/{issue_number}/comments',
            expect.objectContaining({
                owner: 'o',
                repo: 'r',
                issue_number: 5,
                per_page: 100,
                page: 1,
            }),
        );
        expect(requestMock).toHaveBeenNthCalledWith(
            2,
            'GET /repos/{owner}/{repo}/issues/{issue_number}/comments',
            expect.objectContaining({ page: 2 }),
        );
    });
});

interface StatefulComments {
    /** Comments stored on the "server side" of the mock. */
    comments: Array<{ id: number; body: string }>;
    /** Ids passed to DELETE, in call order. */
    deletedIds: number[];
}

/**
 * Creates a stateful mock client whose request method models the real GitHub
 * API lifecycle: POST appends a comment, GET returns the whole list (including
 * comments created moments earlier by POST), DELETE removes a comment.
 *
 * @returns The client plus handles to inspect and pre-populate the mock state.
 */
const createStatefulClient = (): StatefulComments & { client: GitHubClient } => {
    const comments: Array<{ id: number; body: string }> = [];
    const deletedIds: number[] = [];
    let nextId = 1;
    const request = vi.fn(async (route: string, params: Record<string, unknown>) => {
        if (route === 'POST /repos/{owner}/{repo}/issues/{issue_number}/comments') {
            const comment = { id: nextId, body: String(params.body) };
            nextId += 1;
            comments.push(comment);
            return octokitResponse({ ...comment });
        }
        if (route === 'GET /repos/{owner}/{repo}/issues/{issue_number}/comments') {
            return octokitResponse(comments.map((comment) => ({ ...comment })));
        }
        if (route === 'DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}') {
            const id = Number(params.comment_id);
            deletedIds.push(id);
            const index = comments.findIndex((comment) => comment.id === id);
            if (index !== -1) {
                comments.splice(index, 1);
            }
            return octokitResponse({});
        }
        throw new Error(`unexpected route: ${route}`);
    });
    return {
        client: new GitHubClient({ request } as unknown as Octokit, 'o/r'),
        comments,
        deletedIds,
    };
};

describe('reportValidation', () => {
    const requestMock = vi.fn();

    beforeEach(() => {
        requestMock.mockReset();
    });

    const client = (): GitHubClient => new GitHubClient(
        { request: requestMock } as unknown as Octokit,
        'o/r',
    );

    it('leaves exactly one marked comment after a failure run (regression)', async () => {
        const dir = createReportDir([REPORT_FILE_NAME]);
        const { client: statefulClient, comments, deletedIds } = createStatefulClient();
        comments.push({ id: 100, body: `stale ${COMMENT_MARKER}` });
        comments.push({ id: 101, body: 'unrelated comment' });
        try {
            await reportValidation({
                prNumber: 7,
                result: 'failure',
                repoRoot: dir,
                client: statefulClient,
            });

            const markedComments = comments.filter((comment) => isValidationComment(comment.body));
            // The fresh report comment survives the cleanup of the same run.
            expect(markedComments).toHaveLength(1);
            expect(markedComments[0].body).toContain('content of report_locales_error.md');
            // Only the pre-existing stale comment is deleted; the fresh comment
            // id is never passed to DELETE.
            expect(deletedIds).toEqual([100]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('removes every stale marked comment when validation succeeds', async () => {
        const dir = createReportDir([]);
        const { client: statefulClient, comments, deletedIds } = createStatefulClient();
        comments.push({ id: 100, body: `stale ${COMMENT_MARKER}` });
        comments.push({ id: 101, body: `stale too ${COMMENT_MARKER}` });
        comments.push({ id: 102, body: 'unrelated comment' });
        try {
            await reportValidation({
                prNumber: 7,
                result: 'success',
                repoRoot: dir,
                client: statefulClient,
            });

            expect(comments.filter((comment) => isValidationComment(comment.body))).toHaveLength(0);
            expect(deletedIds).toEqual([100, 101]);
            expect(comments.map((comment) => comment.id)).toEqual([102]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('posts a placeholder comment when validation failed but no report exists', async () => {
        const dir = createReportDir([]);
        const { client: statefulClient, comments, deletedIds } = createStatefulClient();
        try {
            await reportValidation({
                prNumber: 7,
                result: 'failure',
                repoRoot: dir,
                client: statefulClient,
            });

            expect(comments).toHaveLength(1);
            expect(comments[0].body).toContain('No validation report was captured.');
            expect(deletedIds).toEqual([]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('still resolves when listing comments fails after posting the report', async () => {
        const dir = createReportDir([REPORT_FILE_NAME]);
        requestMock
            .mockResolvedValueOnce(octokitResponse({ id: 42, body: 'created comment' }))
            .mockRejectedValueOnce(new Error('transient API error'));
        try {
            await expect(reportValidation({
                prNumber: 7,
                result: 'failure',
                repoRoot: dir,
                client: client(),
            })).resolves.toBeUndefined();

            // The fresh report comment was posted before the failure.
            expect(requestMock).toHaveBeenCalledTimes(2);
            expect(requestMock.mock.calls[0][0])
                .toBe('POST /repos/{owner}/{repo}/issues/{issue_number}/comments');
            expect(requestMock.mock.calls[1][0])
                .toBe('GET /repos/{owner}/{repo}/issues/{issue_number}/comments');
            // Cleanup was skipped entirely; no deletions were attempted.
            expect(requestMock.mock.calls.some((call) => call[0].startsWith('DELETE'))).toBe(false);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('still resolves and keeps the report when a stale deletion fails', async () => {
        const dir = createReportDir([REPORT_FILE_NAME]);
        requestMock
            .mockResolvedValueOnce(octokitResponse({ id: 42, body: 'created comment' }))
            .mockResolvedValueOnce(octokitResponse([
                { id: 42, body: `fresh ${COMMENT_MARKER}` },
                { id: 2, body: `stale ${COMMENT_MARKER}` },
            ]))
            .mockRejectedValueOnce(new Error('transient API error'));
        try {
            await expect(reportValidation({
                prNumber: 7,
                result: 'failure',
                repoRoot: dir,
                client: client(),
            })).resolves.toBeUndefined();

            // The fresh comment (42) is never passed to DELETE.
            expect(requestMock).toHaveBeenCalledTimes(3);
            expect(requestMock).toHaveBeenNthCalledWith(
                3,
                'DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}',
                expect.objectContaining({ comment_id: 2 }),
            );
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
