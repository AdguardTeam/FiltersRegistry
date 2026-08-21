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
    let testFile: string;

    beforeAll(async () => {
        // Create a temporary directory structure mimicking the project layout
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'strip-meta-test-'));
        filtersDir = path.join(testDir, 'filters');
        await fs.mkdir(filtersDir);
        testFile = path.join(filtersDir, 'test.txt');

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

        await fs.writeFile(testFile, content, 'utf8');
    });

    afterAll(async () => {
        // Clean up the temporary directory
        await fs.rm(testDir, { recursive: true, force: true });
    });

    it('strips generated metadata lines from .txt files', async () => {
        const modified = await stripGeneratedMetaFromDir(testDir);

        expect(modified).toBe(1);

        const content = await fs.readFile(testFile, 'utf8');
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
        const platformDir = path.join(testDir, 'json_root', 'platforms', 'cli');
        await fs.mkdir(platformDir, { recursive: true });

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

        const jsonFilePath = path.join(platformDir, 'filters.json');
        const jsFilePath = path.join(platformDir, 'filters.js');
        const content = JSON.stringify(metadata, null, '\t');

        await fs.writeFile(jsonFilePath, content, 'utf8');
        await fs.writeFile(jsFilePath, content, 'utf8');

        const modified = await stripGeneratedMetaFromDir(path.join(testDir, 'json_root', 'platforms'));

        expect(modified).toBe(2);

        const jsonContent = JSON.parse(await fs.readFile(jsonFilePath, 'utf8'));
        const jsContent = JSON.parse(await fs.readFile(jsFilePath, 'utf8'));

        [jsonContent, jsContent].forEach((data) => {
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
            const platformsDir = path.join(testDir, dirName, 'platforms');
            const platformDir = path.join(platformsDir, 'cli');
            await fs.mkdir(platformDir, { recursive: true });

            const serialized = JSON.stringify(metadata, null, '\t');
            const content = hasTrailingNewline ? `${serialized}\n` : serialized;

            const jsonFilePath = path.join(platformDir, 'filters.json');
            await fs.writeFile(jsonFilePath, content, 'utf8');

            await stripGeneratedMetaFromDir(platformsDir);

            const rawContent = await fs.readFile(jsonFilePath, 'utf8');
            expect(rawContent).toBe(hasTrailingNewline ? `${expectedSerialized}\n` : expectedSerialized);
        }));
    });

    it('returns 0 for filters.json/filters.js with no version/timeUpdated fields', async () => {
        const platformDir = path.join(testDir, 'json_root_clean', 'platforms', 'cli');
        await fs.mkdir(platformDir, { recursive: true });

        const metadata = { groups: [], tags: [], filters: [{ filterId: 1, name: 'Test filter' }] };
        const jsonFilePath = path.join(platformDir, 'filters.json');
        await fs.writeFile(jsonFilePath, JSON.stringify(metadata, null, '\t'), 'utf8');

        const modified = await stripGeneratedMetaFromDir(path.join(testDir, 'json_root_clean', 'platforms'));
        expect(modified).toBe(0);
    });

    it('throws and leaves the file untouched when filters.json contains invalid JSON', async () => {
        const platformDir = path.join(testDir, 'json_root_invalid', 'platforms', 'cli');
        await fs.mkdir(platformDir, { recursive: true });

        const jsonFilePath = path.join(platformDir, 'filters.json');
        const invalidContent = '{ "filters": [ invalid json here';
        await fs.writeFile(jsonFilePath, invalidContent, 'utf8');

        await expect(
            stripGeneratedMetaFromDir(path.join(testDir, 'json_root_invalid', 'platforms')),
        ).rejects.toThrow(/Failed to parse metadata file/);

        const contentAfter = await fs.readFile(jsonFilePath, 'utf8');
        expect(contentAfter).toBe(invalidContent);
    });

    it('returns 0 and leaves the file untouched when the filters field is missing, null, or not an array', async () => {
        const cases = [
            { dirName: 'json_root_missing_filters', metadata: { groups: [], tags: [] } },
            { dirName: 'json_root_null_filters', metadata: { groups: [], tags: [], filters: null } },
            { dirName: 'json_root_nonarray_filters', metadata: { groups: [], tags: [], filters: 'not-an-array' } },
        ];

        await Promise.all(cases.map(async ({ dirName, metadata }) => {
            const platformDir = path.join(testDir, dirName, 'platforms', 'cli');
            await fs.mkdir(platformDir, { recursive: true });

            const jsonFilePath = path.join(platformDir, 'filters.json');
            const content = JSON.stringify(metadata, null, '\t');
            await fs.writeFile(jsonFilePath, content, 'utf8');

            const modified = await stripGeneratedMetaFromDir(path.join(testDir, dirName, 'platforms'));
            expect(modified).toBe(0);

            const contentAfter = await fs.readFile(jsonFilePath, 'utf8');
            expect(contentAfter).toBe(content);
        }));
    });

    it('returns 0 and leaves the file untouched when filters array entries are null or arrays', async () => {
        const platformDir = path.join(testDir, 'json_root_bad_entries', 'platforms', 'cli');
        await fs.mkdir(platformDir, { recursive: true });

        const metadata = { groups: [], tags: [], filters: [null, ['nested', 'array']] };
        const jsonFilePath = path.join(platformDir, 'filters.json');
        const content = JSON.stringify(metadata, null, '\t');
        await fs.writeFile(jsonFilePath, content, 'utf8');

        const modified = await stripGeneratedMetaFromDir(path.join(testDir, 'json_root_bad_entries', 'platforms'));
        expect(modified).toBe(0);

        const contentAfter = await fs.readFile(jsonFilePath, 'utf8');
        expect(contentAfter).toBe(content);
    });

    it('returns 0 and leaves the file untouched when the filters array is empty', async () => {
        const platformDir = path.join(testDir, 'json_root_empty_filters', 'platforms', 'cli');
        await fs.mkdir(platformDir, { recursive: true });

        const metadata = { groups: [], tags: [], filters: [] };
        const jsonFilePath = path.join(platformDir, 'filters.json');
        const content = JSON.stringify(metadata, null, '\t');
        await fs.writeFile(jsonFilePath, content, 'utf8');

        const modified = await stripGeneratedMetaFromDir(path.join(testDir, 'json_root_empty_filters', 'platforms'));
        expect(modified).toBe(0);

        const contentAfter = await fs.readFile(jsonFilePath, 'utf8');
        expect(contentAfter).toBe(content);
    });
});
