import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { validateJSONSchema } from '@adguard/filters-compiler';
import { validatePatch, PATCH_EXTENSION } from '@adguard/diff-builder';

import { FOLDER_WITH_NEW_FILTERS } from '../build/constants.js';
import { shouldGeneratePatch } from '../build/patches.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILTERS_REQUIRED_AMOUNT = 80;

/**
 * Number of leading lines to scan for the `Diff-Path` tag, matching
 * `@adguard/diff-builder`'s tag parser.
 */
const AMOUNT_OF_LINES_TO_PARSE = 50;

/**
 * Prefix of the `Diff-Path` header tag.
 */
const DIFF_PATH_TAG_PREFIX = '! Diff-Path: ';

/**
 * Maximum size of a git object to buffer, in bytes. The largest platform
 * filter files are several megabytes.
 */
const GIT_MAX_BUFFER = 100 * 1024 * 1024;

/**
 * Extracts the patch path from the `! Diff-Path` header tag of a filter file.
 *
 * @param filterContent Filter file content.
 *
 * @returns Patch path relative to the filter file directory, or null when the
 * tag is absent. A `#resourceName` suffix is not part of the path.
 */
export const parseDiffPath = (filterContent: string): string | null => {
    const lines = filterContent.split('\n');
    const maxLines = Math.min(AMOUNT_OF_LINES_TO_PARSE, lines.length);

    for (let i = 0; i < maxLines; i += 1) {
        const line = lines[i];
        const tagIndex = line.indexOf(DIFF_PATH_TAG_PREFIX);

        if (tagIndex < 0) {
            continue;
        }

        const tagValue = line.substring(tagIndex + DIFF_PATH_TAG_PREFIX.length).trim();

        return tagValue.split('#')[0];
    }

    return null;
};

/**
 * Simulates a client update: checks that the patch named by the old filter's
 * `Diff-Path` transforms the old (committed) filter content into the new
 * (built) one.
 *
 * @param oldContent Content of the filter file at git HEAD.
 * @param newContent Content of the built filter file.
 * @param patchContent Content of the patch named by the old `Diff-Path`.
 *
 * @returns Null when the update is valid, otherwise a description of the problem.
 */
export const validateClientUpdate = (
    oldContent: Buffer,
    newContent: Buffer,
    patchContent: Buffer,
): string | null => {
    if (patchContent.length === 0) {
        return oldContent.equals(newContent)
            ? null
            : 'the Diff-Path patch is empty, but the filter content changed';
    }

    const result = validatePatch(
        oldContent.toString('utf8'),
        newContent.toString('utf8'),
        patchContent.toString('utf8'),
    );

    if (result.valid) {
        return null;
    }

    const reason = result.error instanceof Error ? result.error.message : String(result.error);

    return `the Diff-Path patch does not transform the committed filter into the built one: ${reason.trim()}`;
};

/**
 * Resolves the root directory of the current git repository.
 *
 * @returns Absolute path to the repository root.
 *
 * @throws {Error} If the current directory is not a git checkout.
 */
const getRepoRoot = (): string => {
    try {
        return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    } catch {
        throw new Error('Patch validation requires a git checkout: failed to resolve the repository root');
    }
};

/**
 * Lists files changed in the working tree relative to git HEAD.
 *
 * @param repoRoot Repository root directory.
 * @param dir Directory relative to the repository root.
 *
 * @returns Repository-relative paths of changed files.
 */
const getChangedFiles = (repoRoot: string, dir: string): string[] => {
    const output = execFileSync(
        'git',
        ['diff', '--name-only', 'HEAD', '--', dir],
        { cwd: repoRoot, encoding: 'utf8' },
    );

    return output.split('\n').filter((line) => line.length > 0);
};

/**
 * Reads a file as it is stored in git HEAD.
 *
 * @param repoRoot Repository root directory.
 * @param relativePath Path relative to the repository root.
 *
 * @returns File content, or null when the file does not exist at HEAD.
 */
const readHeadFileContent = (repoRoot: string, relativePath: string): Buffer | null => {
    try {
        return execFileSync(
            'git',
            ['show', `HEAD:${relativePath}`],
            { cwd: repoRoot, maxBuffer: GIT_MAX_BUFFER },
        );
    } catch {
        return null;
    }
};

/**
 * Validates that patches of changed platform filter files are consumable by
 * clients: simulates applying the patch named by the committed filter's
 * `Diff-Path` and requires the result to match the built filter content.
 *
 * Only files changed relative to git HEAD are checked. Files on platforms
 * without patch support are skipped, as are files without a committed
 * `Diff-Path`, new filters, and filters whose patch target is absent (the
 * deliberate full-download transition, AG-59498).
 *
 * @throws {Error} If a patch is empty while the filter changed, or if applying
 * a non-empty patch does not produce the built filter content.
 */
export const validatePlatformPatches = async (): Promise<void> => {
    const repoRoot = getRepoRoot();
    const changedFiles = getChangedFiles(repoRoot, FOLDER_WITH_NEW_FILTERS);

    // eslint-disable-next-line no-restricted-syntax
    for (const relativePath of changedFiles) {
        if (!shouldGeneratePatch(relativePath, [], [])) {
            continue;
        }

        const oldContent = readHeadFileContent(repoRoot, relativePath);
        if (oldContent === null) {
            // New filter: there is no committed version to update from.
            continue;
        }

        const oldDiffPath = parseDiffPath(oldContent.toString('utf8'));
        if (oldDiffPath === null) {
            // No Diff-Path in the committed filter: clients do a full download.
            continue;
        }

        const absolutePath = path.join(repoRoot, relativePath);
        if (!fs.existsSync(absolutePath)) {
            // Deleted file: there is nothing to update.
            continue;
        }

        const patchPath = path.resolve(path.dirname(absolutePath), oldDiffPath);
        if (!fs.existsSync(patchPath)) {
            // The patch target was deliberately removed (oversized patch,
            // AG-59498): clients fall back to a full download.
            continue;
        }

        const newContent = fs.readFileSync(absolutePath);
        const patchContent = fs.readFileSync(patchPath);

        const problem = validateClientUpdate(oldContent, newContent, patchContent);
        if (problem !== null) {
            throw new Error(`Invalid patch for ${relativePath}: ${problem} (patch: ${oldDiffPath})`);
        }
    }
};

/**
 * Asynchronously validates that directory with patches contains only one empty
 * patch file (for future versions).
 *
 * @param dir The directory to validate.
 *
 * @throws {Error} Throws an error if a folder contains more than one empty patch file.
 *
 * @returns A promise that resolves when the validation is complete.
 */
const validatePatchesFolder = async (dir: string): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log(`Validating ${dir}`);

    const files = await fs.promises.readdir(dir);
    let folderContainsPatches = false;
    let emptyPatchesCounter = 0;

    for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        if (file.endsWith(PATCH_EXTENSION)) {
            folderContainsPatches = true;
        }

        const filePath = path.join(dir, file);
        // eslint-disable-next-line no-await-in-loop
        const stat = await fs.promises.stat(filePath);

        if (stat.isDirectory()) {
            // eslint-disable-next-line no-await-in-loop
            await validatePatchesFolder(filePath);
            continue;
        }

        const { size } = stat;
        if (size === 0) {
            emptyPatchesCounter += 1;
        }
    }

    if (folderContainsPatches && emptyPatchesCounter > 1) {
        throw new Error(`Folder ${dir} contains more than one empty patches.`);
    }
};

/**
 * Validates that patch folders do not contain more than one empty patch.
 */
const validatePatches = async (): Promise<void> => {
    await validatePatchesFolder(FOLDER_WITH_NEW_FILTERS);
};

/**
 * Validates built platforms.
 */
const main = async (): Promise<void> => {
    const args = process.argv.slice(2);

    let platforms = args[0];
    if (!platforms) {
        platforms = '../../platforms';
    }

    const platformsPath = path.join(__dirname, platforms);

    const validationResult = validateJSONSchema(platformsPath, FILTERS_REQUIRED_AMOUNT);
    if (!validationResult) {
        throw new Error('Invalid filters json');
    }

    await validatePatches();
    await validatePlatformPatches();
};

// CLI entrypoint: run validation when executed directly.
if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    await main();
}
