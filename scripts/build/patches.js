/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
const fs = require('fs');
const path = require('path');
const { DiffBuilder, PATCH_EXTENSION } = require('@adguard/diff-builder');

const {
    FOLDER_WITH_NEW_FILTERS,
    FOLDER_WITH_OLD_FILTERS,
} = require('./constants');
const { findFiles } = require('../utils/find_files');

/**
 * Parse command-cli parameters -t|--time, -r|--resolution, -i|--include and -s|--skip
 */
let time = 60;
let resolution = 'm';
let includedFilterIDs = [];
let excludedFilterIDs = [];

const args = process.argv.slice(2); // Get command line arguments
args.forEach((val) => {
    if (val.startsWith('-t=') || val.startsWith('--time=')) {
        time = Number.parseInt(val.slice(val.indexOf('=') + 1), 10);
    }

    if (val.startsWith('-r=') || val.startsWith('--resolution=')) {
        resolution = val.slice(val.indexOf('=') + 1);
    }

    if (val.startsWith('-i=') || val.startsWith('--include=')) {
        const value = val.slice(val.indexOf('=') + 1);

        includedFilterIDs = value
            .split(',')
            .map((x) => Number.parseInt(x, 10));
    }

    if (val.startsWith('-s=') || val.startsWith('--skip=')) {
        const value = val.slice(val.indexOf('=') + 1);

        excludedFilterIDs = value
            .split(',')
            .map((x) => Number.parseInt(x, 10));
    }
});

/**
 * Moves the latest patch file from the old patches directory to a new directory.
 *
 * @param oldPatchesDir The directory containing old patch files.
 *
 * @throws {Error} Throws an error if no patch files are found in the specified directory.
 *
 * @returns A promise that resolves when the patch file is successfully moved.
 */
const moveCreatedPatch = async (oldPatchesDir) => {
    // It means, that we don't have any old patches for this filter.
    if (!fs.existsSync(oldPatchesDir)) {
        return;
    }

    const files = await fs.promises.readdir(oldPatchesDir);

    const patches = files
        .filter((f) => f.endsWith(PATCH_EXTENSION))
        .sort((a, b) => b.localeCompare(a));

    if (patches.length === 0) {
        throw new Error(`Not found patches in folder: "${oldPatchesDir}".`);
    }

    const lastPatch = patches[0];

    const fullPath = path.join(oldPatchesDir, lastPatch);
    const pathToMove = fullPath.replace(FOLDER_WITH_OLD_FILTERS, FOLDER_WITH_NEW_FILTERS);

    await fs.promises.copyFile(fullPath, pathToMove);
    console.log(`Moved new patch from "${fullPath}" to "${pathToMove}".`);
};

/**
 * Main function to generate and copy patches for filter files.
 */
const main = async () => {
    // Find all new filter files
    const newFilterFiles = await findFiles(
        FOLDER_WITH_NEW_FILTERS,
        (file) => {
            const fileInFiltersFolder = file.includes('filters/');
            const fileHasTxtExtension = file.endsWith('.txt');

            const filename = path.basename(file);

            if (!/\d+(_optimized|_without_easylist)?\.txt/.test(filename)) {
                console.log(`Skipped generating patch for: ${file}`);

                return false;
            }

            const filterId = Number.parseInt(filename, 10);

            const fileNotExcluded = excludedFilterIDs.length > 0
                ? !excludedFilterIDs.includes(filterId)
                : true;
            const fileIncluded = includedFilterIDs.length > 0
                ? includedFilterIDs.includes(filterId)
                : true;

            const res = fileInFiltersFolder && fileHasTxtExtension && fileNotExcluded && fileIncluded;

            if (!res) {
                console.log(`Skipped generating patch for: ${file}`);
            }

            return res;
        }
    );

    for (let i = 0; i < newFilterFiles.length; i += 1) {
        const newFilterPath = newFilterFiles[i];

        const relativePath = path.relative(FOLDER_WITH_NEW_FILTERS, newFilterPath);
        const oldFilterPath = path.join(FOLDER_WITH_OLD_FILTERS, relativePath);

        const parentDirOfNewFilters = path.dirname(path.dirname(newFilterPath));
        const name = path.basename(newFilterPath, '.txt');
        const patchesPath = path.join(parentDirOfNewFilters, 'patches', name);

        // Generate patches
        await DiffBuilder.buildDiff({
            oldFilterPath,
            newFilterPath,
            patchesPath,
            name,
            time,
            resolution,
            verbose: false,
        });

        // Patch to old filter recorded to temp/platforms folder, because old
        // filters located inside this folder and path to patch is relative
        // to filter.
        await moveCreatedPatch(path.join(path.dirname(path.dirname(oldFilterPath)), 'patches', name));
    }

    // Clear temporary copied platforms
    await fs.promises.rm(FOLDER_WITH_OLD_FILTERS, { recursive: true });
};

main();
