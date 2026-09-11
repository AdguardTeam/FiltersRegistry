import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import {
    buildCommentBody,
    COMMENT_MARKER,
    findLatestReportFile,
    getNextPageUrl,
    GitHubClient,
    isValidationComment,
    readLatestReport,
    reportValidation,
    truncateReport,
} from '../report-validation.js';

const REPORT_PREFIX = 'report_locales_error_';

/**
 * Creates a mock fetch Response with the given JSON body.
 *
 * @param body - Response body to serialize.
 * @param status - HTTP status code.
 * @param headers - Extra response headers.
 * @returns A Response instance.
 */
const jsonResponse = (
    body: unknown,
    status = 200,
    headers: Record<string, string> = {},
): Response => new Response(
    body === null || body === undefined ? null : JSON.stringify(body),
    { status, headers },
);

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

    it('finds the most recent report file by name order', () => {
        const dir = createReportDir([
            `${REPORT_PREFIX}01-01-2026_10-00-00.md`,
            `${REPORT_PREFIX}01-01-2026_11-00-00.md`,
            'unrelated.md',
        ]);
        try {
            expect(findLatestReportFile(dir)).toBe(`${REPORT_PREFIX}01-01-2026_11-00-00.md`);
            expect(readLatestReport(dir)).toBe('content of report_locales_error_01-01-2026_11-00-00.md');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('returns null when no report exists', () => {
        const dir = createReportDir([]);
        try {
            expect(findLatestReportFile(dir)).toBeNull();
            expect(readLatestReport(dir)).toBe('');
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
    const mockFetch = vi.fn();

    beforeEach(() => {
        vi.stubGlobal('fetch', mockFetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        mockFetch.mockReset();
    });

    it('lists comments following pagination', async () => {
        mockFetch
            .mockResolvedValueOnce(jsonResponse(
                [{ id: 1, body: 'first page' }],
                200,
                { link: '<https://api.github.com/repos/o/r/issues/5/comments?page=2>; rel="next"' },
            ))
            .mockResolvedValueOnce(jsonResponse([{ id: 2, body: 'second page' }]));
        const client = new GitHubClient('token', 'o/r');

        const comments = await client.listComments(5);

        expect(comments).toEqual([
            { id: 1, body: 'first page' },
            { id: 2, body: 'second page' },
        ]);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        const firstCall = mockFetch.mock.calls[0];
        expect(firstCall[0]).toContain('/repos/o/r/issues/5/comments?per_page=100');
        expect(firstCall[1]?.headers.Authorization).toBe('Bearer token');
    });
});

describe('reportValidation', () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
        vi.stubGlobal('fetch', mockFetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        mockFetch.mockReset();
    });

    const client = (): GitHubClient => new GitHubClient('token', 'o/r');

    it('deletes stale comments and posts a new failure comment', async () => {
        const dir = createReportDir([`${REPORT_PREFIX}01-01-2026_10-00-00.md`]);
        mockFetch
            .mockResolvedValueOnce(jsonResponse([
                { id: 1, body: 'unrelated comment' },
                { id: 2, body: `stale ${COMMENT_MARKER}` },
            ]))
            .mockResolvedValueOnce(jsonResponse(null, 204))
            .mockResolvedValueOnce(jsonResponse({}));

        await reportValidation({
            prNumber: 7,
            result: 'failure',
            repoRoot: dir,
            client: client(),
        });

        const deleteCall = mockFetch.mock.calls[1];
        expect(deleteCall[0]).toContain('/repos/o/r/issues/comments/2');
        expect(deleteCall[1]?.method).toBe('DELETE');
        const createCall = mockFetch.mock.calls[2];
        expect(createCall[0]).toContain('/repos/o/r/issues/7/comments');
        expect(createCall[1]?.method).toBe('POST');
        const createdBody = JSON.parse(createCall[1]?.body as string).body as string;
        expect(createdBody).toContain(COMMENT_MARKER);
        expect(createdBody).toContain('content of report_locales_error_01-01-2026_10-00-00.md');
        fs.rmSync(dir, {
            recursive: true,
            force: true,
        });
    });

    it('only removes stale comments when validation succeeds', async () => {
        const dir = createReportDir([]);
        mockFetch
            .mockResolvedValueOnce(jsonResponse([{ id: 2, body: `stale ${COMMENT_MARKER}` }]))
            .mockResolvedValueOnce(jsonResponse(null, 204));

        await reportValidation({
            prNumber: 7,
            result: 'success',
            repoRoot: dir,
            client: client(),
        });

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch.mock.calls[1][0]).toContain('/repos/o/r/issues/comments/2');
        fs.rmSync(dir, {
            recursive: true,
            force: true,
        });
    });

    it('posts a placeholder when validation failed but no report exists', async () => {
        const dir = createReportDir([]);
        mockFetch
            .mockResolvedValueOnce(jsonResponse([]))
            .mockResolvedValueOnce(jsonResponse({}));

        await reportValidation({
            prNumber: 7,
            result: 'failure',
            repoRoot: dir,
            client: client(),
        });

        const createCall = mockFetch.mock.calls[1];
        const createdBody = JSON.parse(createCall[1]?.body as string).body as string;
        expect(createdBody).toContain('No validation report was captured.');
        fs.rmSync(dir, {
            recursive: true,
            force: true,
        });
    });
});
