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

describe('reportValidation', () => {
    const requestMock = vi.fn();

    beforeEach(() => {
        requestMock.mockReset();
    });

    const client = (): GitHubClient => new GitHubClient(
        { request: requestMock } as unknown as Octokit,
        'o/r',
    );

    it('posts a new failure comment and then removes stale comments', async () => {
        const dir = createReportDir([REPORT_FILE_NAME]);
        requestMock
            .mockResolvedValueOnce(octokitResponse({}))
            .mockResolvedValueOnce(octokitResponse([
                { id: 1, body: 'unrelated comment' },
                { id: 2, body: `stale ${COMMENT_MARKER}` },
            ]))
            .mockResolvedValueOnce(octokitResponse({}));

        await reportValidation({
            prNumber: 7,
            result: 'failure',
            repoRoot: dir,
            client: client(),
        });

        const createCall = requestMock.mock.calls[0];
        expect(createCall[0]).toBe('POST /repos/{owner}/{repo}/issues/{issue_number}/comments');
        const createParams = createCall[1] as { issue_number: number; body: string };
        expect(createParams.issue_number).toBe(7);
        expect(createParams.body).toContain(COMMENT_MARKER);
        expect(createParams.body).toContain('content of report_locales_error.md');
        expect(requestMock).toHaveBeenNthCalledWith(
            3,
            'DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}',
            expect.objectContaining({ comment_id: 2 }),
        );
        fs.rmSync(dir, {
            recursive: true,
            force: true,
        });
    });

    it('only removes stale comments when validation succeeds', async () => {
        const dir = createReportDir([]);
        requestMock
            .mockResolvedValueOnce(octokitResponse([{ id: 2, body: `stale ${COMMENT_MARKER}` }]))
            .mockResolvedValueOnce(octokitResponse({}));

        await reportValidation({
            prNumber: 7,
            result: 'success',
            repoRoot: dir,
            client: client(),
        });

        expect(requestMock).toHaveBeenCalledTimes(2);
        expect(requestMock).toHaveBeenNthCalledWith(
            1,
            'GET /repos/{owner}/{repo}/issues/{issue_number}/comments',
            expect.objectContaining({ issue_number: 7 }),
        );
        expect(requestMock).toHaveBeenNthCalledWith(
            2,
            'DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}',
            expect.objectContaining({ comment_id: 2 }),
        );
        fs.rmSync(dir, {
            recursive: true,
            force: true,
        });
    });

    it('posts a placeholder when validation failed but no report exists', async () => {
        const dir = createReportDir([]);
        requestMock
            .mockResolvedValueOnce(octokitResponse({}))
            .mockResolvedValueOnce(octokitResponse([]));

        await reportValidation({
            prNumber: 7,
            result: 'failure',
            repoRoot: dir,
            client: client(),
        });

        const createParams = requestMock.mock.calls[0][1] as { body: string };
        expect(createParams.body).toContain('No validation report was captured.');
        fs.rmSync(dir, {
            recursive: true,
            force: true,
        });
    });

    it('still posts the report when stale comment cleanup fails', async () => {
        const dir = createReportDir([REPORT_FILE_NAME]);
        requestMock
            .mockResolvedValueOnce(octokitResponse({}))
            .mockResolvedValueOnce(octokitResponse([{ id: 2, body: `stale ${COMMENT_MARKER}` }]))
            .mockRejectedValueOnce(new Error('transient API error'));

        await expect(reportValidation({
            prNumber: 7,
            result: 'failure',
            repoRoot: dir,
            client: client(),
        })).resolves.toBeUndefined();

        const createParams = requestMock.mock.calls[0][1] as { body: string };
        expect(createParams.body).toContain('content of report_locales_error.md');
        fs.rmSync(dir, {
            recursive: true,
            force: true,
        });
    });
});
