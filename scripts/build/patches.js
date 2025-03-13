/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
const fs = require('fs');
const path = require('path');
const { DiffBuilder } = require('@adguard/diff-builder');

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
 * Main function to generate and copy patches for filter files.
 */
const main = async () => {
    // Find all new filter files
    const newFilterFiles = await findFiles(
        FOLDER_WITH_NEW_FILTERS,
        (file) => {
            // "/" for unix-like or "\\" for windows in path.
            const fileInFiltersFolder = file.includes('filters/') || file.includes('filters\\');
            const fileHasTxtExtension = file.endsWith('.txt');

            const isChromiumMv3 = file.includes('/chromium-mv3/') || file.includes('\\chromium-mv3\\');
            if (isChromiumMv3) {
                console.log('Skipped generating patch for chromium-mv3');
                return false;
            }

            const isAndroidContentBlocker = file.includes('/android-content-blocker/')
                || file.includes('\\android-content-blocker\\');
            if (isAndroidContentBlocker) {
                console.log('Skipped generating patch for android-content-blocker');
                return false;
            }

            // currently supported mac platform is 'mac_v2' so no patch needed for old 'mac' platform
            const isOldMac = file.includes('/mac/') || file.includes('\\mac\\');
            if (isOldMac) {
                console.log('Skipped generating patch for old mac');
                return false;
            }

            const filename = path.basename(file);

            // Just for optimization, skip files that are not in the format of
            // "{filterId}[_optimized|_without_easylist].txt"
            if (!/\d+(_optimized|_without_easylist)?\.txt/.test(filename)) {
                // Skip printing logs for non ".txt" files as redundant.
                if (fileHasTxtExtension) {
                    console.log(`Skipped generating patch for: ${file}`);
                }

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
                // Skip printing logs for non ".txt" files as redundant.
                if (fileHasTxtExtension) {
                    console.log(`Skipped generating patch for: ${file}`);
                }
            }

            return res;
        },
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
            /**
             * Chose 11 days because expiration time of filters is 10 days,
             * so we took it and add one day to exclude overlaps.
             */
            deleteOlderThanSec: 60 * 60 * 24 * 11,
        });
    }

    // Clear temporary copied platforms
    await fs.promises.rm(FOLDER_WITH_OLD_FILTERS, { recursive: true });
};

main();
