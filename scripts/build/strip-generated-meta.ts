import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
 * Single-pass recursive walk: strips metadata from .txt files inside `filters/`
 * directories and counts modified files per `filters/` dir.
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
            // Only process .txt files that are directly inside a `filters/` dir,
            // which is guaranteed by the caller when dir itself is a filters dir.
            if (entry.name.endsWith(TXT_FILE_EXTENSION)) {
                return (await stripGeneratedMeta(fullPath)) ? 1 : 0;
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
 * directories found recursively under the given root.
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
