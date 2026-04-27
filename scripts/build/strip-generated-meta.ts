import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { findFiles } from '../utils/find_files.js';

const FILTERS_DIR_NAME = 'filters';
const TXT_FILE_EXTENSION = '.txt';

/**
 * Lines starting with these prefixes are generated meta — they change on every build
 * regardless of filter content changes, making file comparison noisy.
 */
const GENERATED_META_PREFIXES = [
    '! Checksum:',
    '! Diff-Path:',
    '! TimeUpdated:',
    '! Version:',
] as const;

/**
 * Checks whether a line is a generated meta line that should be stripped.
 *
 * @param line - A single line from a filter file.
 * @returns True if the line starts with a generated meta prefix.
 */
const isGeneratedMetaLine = (line: string): boolean => {
    return GENERATED_META_PREFIXES.some((prefix) => line.startsWith(prefix));
};

/**
 * Strip generated metadata lines from a single filter file in-place.
 *
 * @param filePath - Absolute path to the .txt filter file.
 * @returns True if the file was modified, false otherwise.
 */
const stripGeneratedMeta = async (filePath: string): Promise<boolean> => {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const filtered = lines.filter((line) => !isGeneratedMetaLine(line));

    if (filtered.length === lines.length) {
        return false;
    }

    await fs.writeFile(filePath, filtered.join('\n'), 'utf8');
    return true;
};

/**
 * Recursively find all directories named `filters` under the given root.
 *
 * @param dir - Root directory to search.
 * @returns Array of absolute paths to `filters` directories.
 */
const findFiltersDirs = async (dir: string): Promise<string[]> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    const results = await Promise.all(entries.map(async (entry) => {
        if (!entry.isDirectory()) {
            return [];
        }
        const fullPath = path.join(dir, entry.name);
        if (entry.name === FILTERS_DIR_NAME) {
            return [fullPath];
        }
        return findFiltersDirs(fullPath);
    }));

    return results.flat();
};

const hasTxtExtension = (p: string): boolean => p.endsWith(TXT_FILE_EXTENSION);

/**
 * Strip generated metadata lines from all .txt files inside all `filters/`
 * directories found recursively under the given root.
 *
 * @param rootDir - Root directory to search (e.g. `platforms/`).
 * @returns Number of files actually modified.
 */
export const stripGeneratedMetaFromDir = async (rootDir: string): Promise<number> => {
    const filtersDirs = await findFiltersDirs(rootDir);

    const counts = await Promise.all(filtersDirs.map(async (filtersDir) => {
        const files = await findFiles(filtersDir, hasTxtExtension);
        const results = await Promise.all(files.map(stripGeneratedMeta));
        const modified = results.filter(Boolean).length;

        if (modified > 0) {
            // eslint-disable-next-line no-console
            console.log(`${path.relative(rootDir, filtersDir)}: stripped metadata from ${modified} file(s)`);
        }

        return modified;
    }));

    return counts.reduce((sum, count) => sum + count, 0);
};

// CLI entrypoint: strip generated meta from platform build outputs when run directly
if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const rootDirs = process.argv[2]
        ? [path.resolve(process.argv[2])]
        : [path.resolve('platforms'), path.resolve('temp', 'platforms')];

    let total = 0;
    for (const rootDir of rootDirs) {
        if (existsSync(rootDir)) {
            const count = await stripGeneratedMetaFromDir(rootDir);
            // eslint-disable-next-line no-console
            console.log(`${path.relative('.', rootDir)}: ${count} file(s) modified.`);
            total += count;
        }
    }
    // eslint-disable-next-line no-console
    console.log(`Done. ${total} file(s) modified in total.`);
}
