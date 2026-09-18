import {
    describe, it, expect, beforeAll, afterAll,
} from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { stripGeneratedMetaFromDir } from '../strip-generated-meta.js';

/**
 * Test that stripGeneratedMetaFromDir actually strips generated metadata lines
 * from .txt files inside `filters/` directories.
 */
describe('stripGeneratedMetaFromDir', () => {
    let testDir: string;
    let filtersDir: string;
    let testFilePath: string;

    beforeAll(async () => {
        // Create a temporary directory structure mimicking the project layout
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'strip-meta-test-'));
        filtersDir = path.join(testDir, 'filters');
        await fs.mkdir(filtersDir);
        testFilePath = path.join(filtersDir, 'test.txt');

        // Create a test file with generated metadata lines
        const content = [
            '! Checksum: abc123',
            '! Diff-Path: somewhere/diff.txt',
            '! TimeUpdated: 2026-04-27T10:00:00Z',
            '! Version: 1.0.0',
            '',
            '! Normal comment',
            '||example.com^',
            '##.ads-banner',
            '',
        ].join('\n');

        await fs.writeFile(testFilePath, content, 'utf8');
    });

    afterAll(async () => {
        // Clean up the temporary directory
        await fs.rm(testDir, { recursive: true, force: true });
    });

    /**
     * Creates `<testDir>/<dirName>/platforms/cli/` and writes `content` verbatim
     * to each of `fileNames` inside it.
     *
     * @param dirName - Unique sub-directory name isolating this case's tree.
     * @param content - Exact bytes to write to every file.
     * @param fileNames - Metadata file names to create (default: `filters.json`).
     * @returns The `platforms` dir to pass to `stripGeneratedMetaFromDir`, plus the written file paths.
     */
    const writeMetadataFiles = async (
        dirName: string,
        content: string,
        fileNames: string[] = ['filters.json'],
    ): Promise<{ platformsDir: string; filePaths: string[] }> => {
        const platformsDir = path.join(testDir, dirName, 'platforms');
        const platformDir = path.join(platformsDir, 'cli');
        await fs.mkdir(platformDir, { recursive: true });

        const filePaths = await Promise.all(fileNames.map(async (name) => {
            const filePath = path.join(platformDir, name);
            await fs.writeFile(filePath, content, 'utf8');
            return filePath;
        }));

        return { platformsDir, filePaths };
    };

    it('strips generated metadata lines from .txt files', async () => {
        const modified = await stripGeneratedMetaFromDir(testDir);

        expect(modified).toBe(1);

        const content = await fs.readFile(testFilePath, 'utf8');
        const lines = content.split('\n');

        // Generated meta lines should be removed
        expect(lines.some((line) => line.startsWith('! Checksum:'))).toBe(false);
        expect(lines.some((line) => line.startsWith('! Diff-Path:'))).toBe(false);
        expect(lines.some((line) => line.startsWith('! TimeUpdated:'))).toBe(false);
        expect(lines.some((line) => line.startsWith('! Version:'))).toBe(false);

        // Normal content should remain
        expect(lines.some((line) => line.includes('Normal comment'))).toBe(true);
        expect(lines.some((line) => line.includes('||example.com^'))).toBe(true);
        expect(lines.some((line) => line.includes('##.ads-banner'))).toBe(true);
    });

    it('returns 0 when no files need modification', async () => {
        // Second run should not modify anything since metadata is already stripped
        const modified = await stripGeneratedMetaFromDir(testDir);
        expect(modified).toBe(0);
    });

    it('strips filters metadata consistently from two separate directory trees', async () => {
        // Simulate the build.js scenario where we have:
        // - new build output (platforms/)
        // - old baseline copy (temp/platforms/)
        // and both need to be stripped consistently.

        const oldRootDir = path.join(testDir, 'old_root', 'platforms');
        const newRootDir = path.join(testDir, 'new_root', 'platforms');
        const oldDir = path.join(oldRootDir, 'filters');
        const newDir = path.join(newRootDir, 'filters');

        await fs.mkdir(oldDir, { recursive: true });
        await fs.mkdir(newDir, { recursive: true });

        const content = [
            '! Checksum: abc123',
            '! Diff-Path: somewhere/diff.txt',
            '! TimeUpdated: 2026-04-27T10:00:00Z',
            '! Version: 1.0.0',
            '',
            '||example.com^',
            '',
        ].join('\n');

        const oldFilePath = path.join(oldDir, 'test.txt');
        const newFilePath = path.join(newDir, 'test.txt');

        await fs.writeFile(oldFilePath, content, 'utf8');
        await fs.writeFile(newFilePath, content, 'utf8');

        // Strip from both directories as build.js does when --strip-generated-meta is set
        const newCount = await stripGeneratedMetaFromDir(newRootDir);
        const oldCount = await stripGeneratedMetaFromDir(oldRootDir);

        expect(newCount).toBe(1);
        expect(oldCount).toBe(1);

        // Verify both files are identically stripped
        const oldContent = await fs.readFile(oldFilePath, 'utf8');
        const newContent = await fs.readFile(newFilePath, 'utf8');

        expect(oldContent).toBe(newContent);
        expect(oldContent.includes('! Checksum:')).toBe(false);
        expect(oldContent.includes('! Diff-Path:')).toBe(false);
        expect(oldContent.includes('! TimeUpdated:')).toBe(false);
        expect(oldContent.includes('! Version:')).toBe(false);
        expect(oldContent.includes('||example.com^')).toBe(true);
    });

    it('strips version/timeUpdated fields from filters.json and filters.js', async () => {
        const metadata = {
            groups: [],
            tags: [],
            filters: [
                {
                    filterId: 1,
                    name: 'Test filter',
                    timeAdded: '2014-06-30T07:56:55+0000',
                    version: '2.1.8.0',
                    timeUpdated: '2026-08-10T18:21:50+0000',
                    deprecated: false,
                },
            ],
        };

        const content = JSON.stringify(metadata, null, '\t');
        const { platformsDir, filePaths } = await writeMetadataFiles(
            'json_root',
            content,
            ['filters.json', 'filters.js'],
        );

        const modified = await stripGeneratedMetaFromDir(platformsDir);

        expect(modified).toBe(2);

        const parsed = await Promise.all(filePaths.map(async (p) => JSON.parse(await fs.readFile(p, 'utf8'))));

        parsed.forEach((data) => {
            expect(data.filters[0]).not.toHaveProperty('version');
            expect(data.filters[0]).not.toHaveProperty('timeUpdated');
            expect(data.filters[0].filterId).toBe(1);
            expect(data.filters[0].name).toBe('Test filter');
            expect(data.filters[0].timeAdded).toBe('2014-06-30T07:56:55+0000');
        });
    });

    it('preserves tab indentation and trailing-newline from filters.json and filters.js', async () => {
        const preservedFilter = { filterId: 1, name: 'Test filter' };
        const metadata = {
            groups: [],
            tags: [],
            filters: [{ ...preservedFilter, version: '2.1.8.0', timeUpdated: '2026-08-10T18:21:50+0000' }],
        };
        const expectedSerialized = JSON.stringify({ ...metadata, filters: [preservedFilter] }, null, '\t');

        const cases = [
            { dirName: 'json_root_raw_no_newline', hasTrailingNewline: false },
            { dirName: 'json_root_raw_with_newline', hasTrailingNewline: true },
        ];

        await Promise.all(cases.map(async ({ dirName, hasTrailingNewline }) => {
            const serialized = JSON.stringify(metadata, null, '\t');
            const content = hasTrailingNewline ? `${serialized}\n` : serialized;
            const expected = hasTrailingNewline ? `${expectedSerialized}\n` : expectedSerialized;

            const { platformsDir, filePaths } = await writeMetadataFiles(
                dirName,
                content,
                ['filters.json', 'filters.js'],
            );

            await stripGeneratedMetaFromDir(platformsDir);

            await Promise.all(filePaths.map(async (filePath) => {
                expect(await fs.readFile(filePath, 'utf8')).toBe(expected);
            }));
        }));
    });

    it('returns 0 for filters.json/filters.js with no version/timeUpdated fields', async () => {
        const metadata = { groups: [], tags: [], filters: [{ filterId: 1, name: 'Test filter' }] };
        const { platformsDir } = await writeMetadataFiles('json_root_clean', JSON.stringify(metadata, null, '\t'));

        const modified = await stripGeneratedMetaFromDir(platformsDir);
        expect(modified).toBe(0);
    });

    it('throws and leaves the file untouched when filters.json contains invalid JSON', async () => {
        const invalidContent = '{ "filters": [ invalid json here';
        const {
            platformsDir,
            filePaths: [jsonFilePath],
        } = await writeMetadataFiles('json_root_invalid', invalidContent);

        await expect(
            stripGeneratedMetaFromDir(platformsDir),
        ).rejects.toThrow(/Failed to parse metadata file/);

        const contentAfter = await fs.readFile(jsonFilePath, 'utf8');
        expect(contentAfter).toBe(invalidContent);
    });

    it('returns 0 and leaves the file untouched when filters is missing, null, non-array, or empty', async () => {
        const cases = [
            { dirName: 'json_root_missing_filters', metadata: { groups: [], tags: [] } },
            { dirName: 'json_root_null_filters', metadata: { groups: [], tags: [], filters: null } },
            { dirName: 'json_root_nonarray_filters', metadata: { groups: [], tags: [], filters: 'not-an-array' } },
            { dirName: 'json_root_empty_filters', metadata: { groups: [], tags: [], filters: [] } },
        ];

        await Promise.all(cases.map(async ({ dirName, metadata }) => {
            const content = JSON.stringify(metadata, null, '\t');
            const {
                platformsDir,
                filePaths: [jsonFilePath],
            } = await writeMetadataFiles(dirName, content);

            const modified = await stripGeneratedMetaFromDir(platformsDir);
            expect(modified).toBe(0);

            const contentAfter = await fs.readFile(jsonFilePath, 'utf8');
            expect(contentAfter).toBe(content);
        }));
    });
});
