import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const FILTERS_DIR_NAME = 'filters';
const TXT_FILE_EXTENSION = '.txt';
const METADATA_FILE_NAMES = ['filters.json', 'filters.js'];

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
 * Fields inside each entry of the `filters` array in filters.json/filters.js that are
 * generated meta — same rationale as GENERATED_META_PREFIXES, but for the JSON metadata files.
 */
const GENERATED_META_FIELDS = ['version', 'timeUpdated'] as const;

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
 * Checks whether an array contains only non-null objects (i.e. records).
 * @param value - The array to check.
 * @returns True if every item in the array is a non-null object.
 */
const isRecordArray = (value: unknown[]): value is Record<string, unknown>[] => {
    return value.every((item) => typeof item === 'object' && item !== null);
};

/**
 * Strip generated version/timeUpdated fields from each entry of the `filters` array
 * in a filters.json/filters.js metadata file, in-place.
 *
 * @param filePath - Absolute path to the filters.json or filters.js file.
 * @returns True if the file was modified, false otherwise.
 */
const stripMetaFromMetadataFile = async (filePath: string): Promise<boolean> => {
    const content = await fs.readFile(filePath, 'utf8');
    let data: { filters?: unknown };

    try {
        data = JSON.parse(content) as { filters?: unknown };
    } catch (error) {
        const reason = error instanceof Error ? ` ${error.message}` : '';
        throw new Error(
            `Failed to parse metadata file at ${filePath}. The file must contain valid JSON.${reason}`,
        );
    }

    if (!Array.isArray(data.filters) || !isRecordArray(data.filters)) {
        return false;
    }

    let modified = false;
    data.filters.forEach((filter) => {
        GENERATED_META_FIELDS.forEach((field) => {
            if (field in filter) {
                delete filter[field];
                modified = true;
            }
        });
    });

    if (!modified) {
        return false;
    }

    await fs.writeFile(filePath, JSON.stringify(data, null, '\t'), 'utf8');
    return true;
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
 * Single-pass recursive walk: strips metadata from .txt files inside `filters/`
 * directories, and from any `filters.json`/`filters.js` metadata files found
 * anywhere under the root, counting modified files per `filters/` dir.
 *
 * When a directory named `filters` is encountered, all .txt files inside it are
 * processed immediately — no second traversal is needed.
 *
 * @param dir - Current directory being walked.
 * @param rootDir - Top-level root (used only for log output).
 * @returns Number of files actually modified under this subtree.
 */
const walkAndStrip = async (dir: string, rootDir: string): Promise<number> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    const counts = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);

        if (!entry.isDirectory()) {
            if (entry.name.endsWith(TXT_FILE_EXTENSION)) {
                return (await stripGeneratedMeta(fullPath)) ? 1 : 0;
            }
            if (METADATA_FILE_NAMES.includes(entry.name)) {
                return (await stripMetaFromMetadataFile(fullPath)) ? 1 : 0;
            }
            return 0;
        }

        if (entry.name === FILTERS_DIR_NAME) {
            // Process all .txt files inside this `filters/` dir in one pass.
            const modified = await walkAndStrip(fullPath, rootDir);
            if (modified > 0) {
                // eslint-disable-next-line no-console
                console.log(`${path.relative(rootDir, fullPath)}: stripped metadata from ${modified} file(s)`);
            }
            return modified;
        }

        return walkAndStrip(fullPath, rootDir);
    }));

    return counts.reduce((sum: number, count: number) => sum + count, 0);
};

/**
 * Strip generated metadata lines from all .txt files inside all `filters/`
 * directories, and generated version/timeUpdated fields from all
 * `filters.json`/`filters.js` files, found recursively under the given root.
 *
 * @param rootDir - Root directory to search (e.g. `platforms/`).
 * @returns Number of files actually modified.
 */
export const stripGeneratedMetaFromDir = async (rootDir: string): Promise<number> => {
    return walkAndStrip(rootDir, rootDir);
};

// CLI entrypoint: strip generated meta from platform build outputs when run directly
if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const rootDirs = process.argv[2]
        ? [path.resolve(process.argv[2])]
        : [path.resolve('platforms'), path.resolve('temp', 'platforms')];

    const results = await Promise.all(
        rootDirs
            .filter((dir) => existsSync(dir))
            .map(async (rootDir) => {
                const count = await stripGeneratedMetaFromDir(rootDir);
                // eslint-disable-next-line no-console
                console.log(`${path.relative('.', rootDir)}: ${count} file(s) modified.`);
                return count;
            }),
    );

    const total = results.reduce((sum, count) => sum + count, 0);
    // eslint-disable-next-line no-console
    console.log(`Done. ${total} file(s) modified in total.`);
}
