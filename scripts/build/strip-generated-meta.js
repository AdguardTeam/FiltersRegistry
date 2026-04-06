import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLATFORMS_DIR = path.join(__dirname, '../../platforms');
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
];

/**
 * Checks whether a line is a generated meta line that should be stripped.
 *
 * @param {string} line - A single line from a filter file.
 * @returns {boolean} True if the line starts with a generated meta prefix.
 */
const isGeneratedMetaLine = (line) => {
    return GENERATED_META_PREFIXES.some((prefix) => line.startsWith(prefix));
};

/**
 * Strip generated metadata lines from a single filter file in-place.
 *
 * @param {string} filePath - Absolute path to the .txt filter file.
 * @returns {Promise<boolean>} True if the file was modified, false otherwise.
 */
const stripGeneratedMeta = async (filePath) => {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const filtered = lines.filter((line) => !isGeneratedMetaLine(line));

    if (filtered.length === lines.length) {
        return false;
    }

    await fs.promises.writeFile(filePath, filtered.join('\n'), 'utf8');
    return true;
};

/**
 * Recursively find all .txt files inside a given directory.
 *
 * @param {string} dir - Root directory to search.
 * @returns {Promise<string[]>} Array of absolute paths to .txt files.
 */
const findTxtFiles = async (dir) => {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    const results = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return findTxtFiles(fullPath);
        }
        if (entry.isFile() && entry.name.endsWith(TXT_FILE_EXTENSION)) {
            return [fullPath];
        }
        return [];
    }));

    return results.flat();
};

/**
 * Recursively find all directories named `filters` under the given root.
 *
 * @param {string} dir - Root directory to search.
 * @returns {Promise<string[]>} Array of absolute paths to `filters` directories.
 */
const findFiltersDirs = async (dir) => {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

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

/**
 * Strip generated metadata lines from all .txt files inside all `filters/`
 * directories found recursively under the given root.
 *
 * @param {string} rootDir - Root directory to search (e.g. `platforms/`).
 * @returns {Promise<number>} Number of files actually modified.
 */
export const stripGeneratedMetaFromDir = async (rootDir) => {
    const filtersDirs = await findFiltersDirs(rootDir);

    const counts = await Promise.all(filtersDirs.map(async (filtersDir) => {
        const files = await findTxtFiles(filtersDir);
        const results = await Promise.all(files.map((f) => stripGeneratedMeta(f)));
        const modified = results.filter(Boolean).length;

        if (modified > 0) {
            // eslint-disable-next-line no-console
            console.log(`${path.relative(rootDir, filtersDir)}: stripped metadata from ${modified} file(s)`);
        }

        return modified;
    }));

    return counts.reduce((sum, count) => sum + count, 0);
};

/**
 * Main entry point (standalone execution).
 * Recursively finds all `filters/` directories under platforms/ and strips
 * generated meta headers from every .txt file found there.
 */
const main = async () => {
    const totalModified = await stripGeneratedMetaFromDir(PLATFORMS_DIR);

    // eslint-disable-next-line no-console
    console.log(`Done. Total files modified: ${totalModified}`);
};

// Run only when executed directly, not when imported as a module.
if (process.argv[1] === __filename) {
    main();
}
