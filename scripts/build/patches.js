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
 * Copies old patch files from one directory to another.
 *
 * @param oldFilterDir The directory containing old patch files.
 * @param newFilterDir The directory where old patch files will be copied.
 */
const copyOldPatches = async (oldFilterDir, newFilterDir) => {
    const oldPatches = await findFiles(
        oldFilterDir,
        (file) => file.endsWith(PATCH_EXTENSION)
    );

    for (let i = 0; i < oldPatches.length; i += 1) {
        const oldPatch = oldPatches[i];
        const relativePath = path.relative(oldFilterDir, oldPatch);
        const newPath = path.join(newFilterDir, relativePath);

        try {
            await fs.promises.mkdir(path.dirname(newPath), { recursive: true });
            await fs.promises.copyFile(oldPatch, newPath);
        } catch (error) {
            console.error(`Error copying old patch ${oldPatch} to ${newPath}: ${error}`);
        }
    }
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
            verbose: true,
        });
    }

    // Copy old patches
    await copyOldPatches(FOLDER_WITH_OLD_FILTERS, FOLDER_WITH_NEW_FILTERS);

    // Clear temporary copied platforms
    await fs.promises.rm(FOLDER_WITH_OLD_FILTERS, { recursive: true });
};

main();
