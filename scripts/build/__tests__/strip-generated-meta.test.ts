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
});
