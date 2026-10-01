import {
    describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import CryptoJS from 'crypto-js';
import {
    parseDiffPath,
    validateClientUpdate,
    validatePlatformPatches,
} from '../../validation/validate_platforms.js';

const gitMock = vi.hoisted(() => ({
    repoRoot: '',
    changedFiles: [] as string[],
    headContents: new Map<string, string>(),
}));

vi.mock('child_process', async (importOriginal) => {
    const actual = await importOriginal<typeof import('child_process')>();
    return {
        ...actual,
        execFileSync: vi.fn((command: string, args: string[], options: unknown) => {
            if (command !== 'git') {
                return actual.execFileSync(command, args, options as never);
            }

            if (args[0] === 'rev-parse') {
                return gitMock.repoRoot;
            }

            if (args[0] === 'diff') {
                return gitMock.changedFiles.join('\n');
            }

            if (args[0] === 'show') {
                const relativePath = args[1].replace(/^HEAD:/, '');
                const content = gitMock.headContents.get(relativePath);

                if (content === undefined) {
                    throw new Error(`File is not present at HEAD: ${relativePath}`);
                }

                return Buffer.from(content, 'utf8');
            }

            throw new Error(`Unexpected git command: ${args.join(' ')}`);
        }),
    };
});

describe('parseDiffPath', () => {
    it('extracts the patch path from a LF filter', () => {
        const content = '! Checksum: abc\n! Diff-Path: ../patches/1/1-s-1-3600.patch\n! Title: Test\n';

        expect(parseDiffPath(content)).toBe('../patches/1/1-s-1-3600.patch');
    });

    it('extracts the patch path from a CRLF filter', () => {
        const content = '! Checksum: abc\r\n! Diff-Path: ../patches/1/1-s-1-3600.patch\r\n! Title: Test\r\n';

        expect(parseDiffPath(content)).toBe('../patches/1/1-s-1-3600.patch');
    });

    it('strips the resource name suffix', () => {
        const content = '! Diff-Path: ../patches/1/1-s-1-3600.patch#resource\n';

        expect(parseDiffPath(content)).toBe('../patches/1/1-s-1-3600.patch');
    });

    it('returns null when the tag is absent', () => {
        expect(parseDiffPath('! Title: Test\n')).toBeNull();
    });

    it('does not look for the tag beyond the first 50 lines', () => {
        const content = `${'!\n'.repeat(50)}! Diff-Path: ../patches/1/1-s-1-3600.patch\n`;

        expect(parseDiffPath(content)).toBeNull();
    });
});

describe('validateClientUpdate', () => {
    const oldContent = Buffer.from('! Title: Test\r\n! Version: 1\r\n', 'utf8');
    const newContent = Buffer.from('! Title: Test\r\n! Version: 2\r\n', 'utf8');
    const rcsPatch = 'd2 1\na2 1\n! Version: 2\r\n';

    it('passes when the patch is empty and the content is unchanged', () => {
        expect(validateClientUpdate(oldContent, oldContent, Buffer.alloc(0))).toBeNull();
    });

    it('fails when the patch is empty but the content changed', () => {
        expect(validateClientUpdate(oldContent, newContent, Buffer.alloc(0)))
            .toBe('the Diff-Path patch is empty, but the filter content changed');
    });

    it('passes when a non-empty patch transforms the old content into the new one', () => {
        expect(validateClientUpdate(oldContent, newContent, Buffer.from(rcsPatch, 'utf8'))).toBeNull();
    });

    it('fails when a non-empty patch cannot be parsed', () => {
        expect(validateClientUpdate(oldContent, newContent, Buffer.from('x1 1\n', 'utf8')))
            .toBe(
                'the Diff-Path patch does not transform the committed filter into the built one: '
                + 'Operation is not valid: cannot parse type: x1 1',
            );
    });

    it('fails when a non-empty patch produces different content', () => {
        const wrongPatch = 'd2 1\na2 1\n! Version: 3\r\n';

        expect(validateClientUpdate(oldContent, newContent, Buffer.from(wrongPatch, 'utf8')))
            .toBe(
                'the Diff-Path patch does not transform the committed filter into the built one: '
                + 'old file with applied patch is not equal to new file.',
            );
    });

    it('passes when the diff directive checksum matches', () => {
        const checksum = CryptoJS.SHA1(newContent.toString('utf8')).toString();
        const patch = `diff checksum:${checksum} lines:3\n${rcsPatch}`;

        expect(validateClientUpdate(oldContent, newContent, Buffer.from(patch, 'utf8'))).toBeNull();
    });

    it('fails when the diff directive checksum does not match', () => {
        const patch = `diff checksum:${'0'.repeat(40)} lines:3\n${rcsPatch}`;

        expect(validateClientUpdate(oldContent, newContent, Buffer.from(patch, 'utf8')))
            .toBe(
                'the Diff-Path patch does not transform the committed filter into the built one: '
                + 'Checksums are not equal.',
            );
    });
});

describe('validatePlatformPatches', () => {
    let repoRoot = '';

    const writeRepoFile = async (relativePath: string, content: string): Promise<void> => {
        const absolutePath = path.join(repoRoot, relativePath);
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, content);
    };

    beforeEach(async () => {
        repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'validate-platforms-test-'));
        gitMock.repoRoot = repoRoot;
        gitMock.changedFiles = [];
        gitMock.headContents = new Map<string, string>();
    });

    afterEach(async () => {
        await fs.rm(repoRoot, { recursive: true, force: true });
        vi.clearAllMocks();
    });

    it('fails when the patch is empty but the filter content changed (AG-59498)', async () => {
        const oldContent = '! Checksum: abc\n! Diff-Path: ../patches/1/1-s-1-3600.patch\n! Version: 1\n';
        const newContent = '! Checksum: def\n! Diff-Path: ../patches/1/1-s-2-3600.patch\n! Version: 2\n';

        gitMock.changedFiles = ['platforms/windows/filters/1.txt'];
        gitMock.headContents.set('platforms/windows/filters/1.txt', oldContent);
        await writeRepoFile('platforms/windows/filters/1.txt', newContent);
        await writeRepoFile('platforms/windows/patches/1/1-s-1-3600.patch', '');

        await expect(validatePlatformPatches()).rejects.toThrow(
            'Invalid patch for platforms/windows/filters/1.txt: '
            + 'the Diff-Path patch is empty, but the filter content changed '
            + '(patch: ../patches/1/1-s-1-3600.patch)',
        );
    });

    it('passes when the patch is empty and the filter is unchanged', async () => {
        const content = '! Diff-Path: ../patches/1/1-s-1-3600.patch\n! Version: 1\n';

        gitMock.changedFiles = ['platforms/windows/filters/1.txt'];
        gitMock.headContents.set('platforms/windows/filters/1.txt', content);
        await writeRepoFile('platforms/windows/filters/1.txt', content);
        await writeRepoFile('platforms/windows/patches/1/1-s-1-3600.patch', '');

        await expect(validatePlatformPatches()).resolves.toBeUndefined();
    });

    it('passes when a non-empty patch transforms the committed filter into the built one', async () => {
        const oldContent = '! Title: Test\r\n! Diff-Path: ../patches/1/1-s-1-3600.patch\r\n! Version: 1\r\n';
        const newContent = '! Title: Test\r\n! Diff-Path: ../patches/1/1-s-1-3600.patch\r\n! Version: 2\r\n';
        const rcsPatch = 'd3 1\na3 1\n! Version: 2\r\n';

        gitMock.changedFiles = ['platforms/windows/filters/1.txt'];
        gitMock.headContents.set('platforms/windows/filters/1.txt', oldContent);
        await writeRepoFile('platforms/windows/filters/1.txt', newContent);
        await writeRepoFile('platforms/windows/patches/1/1-s-1-3600.patch', rcsPatch);

        await expect(validatePlatformPatches()).resolves.toBeUndefined();
    });

    it('fails when a non-empty patch does not produce the built filter', async () => {
        const oldContent = '! Title: Test\r\n! Diff-Path: ../patches/1/1-s-1-3600.patch\r\n! Version: 1\r\n';
        const newContent = '! Title: Test\r\n! Version: 2\r\n';

        gitMock.changedFiles = ['platforms/windows/filters/1.txt'];
        gitMock.headContents.set('platforms/windows/filters/1.txt', oldContent);
        await writeRepoFile('platforms/windows/filters/1.txt', newContent);
        await writeRepoFile('platforms/windows/patches/1/1-s-1-3600.patch', 'x1 1\n');

        await expect(validatePlatformPatches()).rejects.toThrow(
            'Invalid patch for platforms/windows/filters/1.txt: '
            + 'the Diff-Path patch does not transform the committed filter into the built one: '
            + 'Operation is not valid: cannot parse type: x1 1 '
            + '(patch: ../patches/1/1-s-1-3600.patch)',
        );
    });

    it('passes when the patch target is absent (full-download transition)', async () => {
        const oldContent = '! Diff-Path: ../patches/1/1-s-1-3600.patch\n! Version: 1\n';

        gitMock.changedFiles = ['platforms/windows/filters/1.txt'];
        gitMock.headContents.set('platforms/windows/filters/1.txt', oldContent);
        await writeRepoFile('platforms/windows/filters/1.txt', '! Version: 2\n');

        await expect(validatePlatformPatches()).resolves.toBeUndefined();
    });

    it('skips files without a committed Diff-Path', async () => {
        gitMock.changedFiles = ['platforms/windows/filters/1.txt'];
        gitMock.headContents.set('platforms/windows/filters/1.txt', '! Version: 1\n');
        await writeRepoFile('platforms/windows/filters/1.txt', '! Version: 2\n');

        await expect(validatePlatformPatches()).resolves.toBeUndefined();
    });

    it('skips new filters that do not exist at HEAD', async () => {
        gitMock.changedFiles = ['platforms/windows/filters/1.txt'];
        await writeRepoFile('platforms/windows/filters/1.txt', '! Version: 1\n');

        await expect(validatePlatformPatches()).resolves.toBeUndefined();
    });

    it('skips platforms without patch support', async () => {
        const oldContent = '! Diff-Path: ../patches/1/1-s-1-3600.patch\n! Version: 1\n';
        const changedFiles = [
            'platforms/mac/filters/1.txt',
            'platforms/extension/chromium-mv3/filters/1.txt',
            'platforms/extension/android-content-blocker/filters/1.txt',
        ];

        gitMock.changedFiles = changedFiles;

        // eslint-disable-next-line no-restricted-syntax
        for (const relativePath of changedFiles) {
            gitMock.headContents.set(relativePath, oldContent);
            // eslint-disable-next-line no-await-in-loop
            await writeRepoFile(relativePath, '! Version: 2\n');
            // eslint-disable-next-line no-await-in-loop
            await writeRepoFile(
                relativePath.replace('/filters/', '/patches/').replace('.txt', '/1-s-1-3600.patch'),
                '',
            );
        }

        await expect(validatePlatformPatches()).resolves.toBeUndefined();
    });
});
