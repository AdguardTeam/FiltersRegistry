/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DiffBuilder, type BuildDiffParams } from '@adguard/diff-builder';
import {
    FOLDER_WITH_NEW_FILTERS,
    FOLDER_WITH_OLD_FILTERS,
} from './constants.js';
import { parseFilterIDs } from './filter-id-list.js';
import { findFiles } from '../utils/find_files.js';

/**
 * Parse command-cli parameters -t|--time, -r|--resolution, -i|--include and -s|--skip
 */
let time = 60;
let resolution: NonNullable<BuildDiffParams['resolution']> = 'm';
let cliIncludedFilterIDs: number[] = [];
let cliExcludedFilterIDs: number[] = [];

const args = process.argv.slice(2); // Get command line arguments
args.forEach((val) => {
    if (val.startsWith('-t=') || val.startsWith('--time=')) {
        time = Number.parseInt(val.slice(val.indexOf('=') + 1), 10);
    }

    if (val.startsWith('-r=') || val.startsWith('--resolution=')) {
        resolution = val.slice(val.indexOf('=') + 1) as NonNullable<BuildDiffParams['resolution']>;
    }

    if (val.startsWith('-i=') || val.startsWith('--include=')) {
        const value = val.slice(val.indexOf('=') + 1);

        cliIncludedFilterIDs = parseFilterIDs(value);
    }

    if (val.startsWith('-s=') || val.startsWith('--skip=')) {
        const value = val.slice(val.indexOf('=') + 1);

        cliExcludedFilterIDs = parseFilterIDs(value);
    }
});

/**
 * Directory names of the MV3 extension platforms for which patches are not generated.
 */
const MV3_PLATFORM_DIRS = ['chromium-mv3', 'opera-mv3', 'edge-mv3'];

/**
 * Checks whether a patch should be generated for the given platform filter file.
 *
 * Patches are skipped for the MV3 extension platforms, for the Android Content
 * Blocker, and for the old mac (v1) platform.
 *
 * @param file - Path of the platform filter file.
 * @param includedFilterIDs - Filter IDs to include; empty (default) processes all.
 * @param excludedFilterIDs - Filter IDs to exclude; empty (default) excludes none.
 * @returns True if a patch should be generated for the file.
 */
export const shouldGeneratePatch = (
    file: string,
    includedFilterIDs: number[],
    excludedFilterIDs: number[],
): boolean => {
    // "/" for unix-like or "\\" for windows in path.
    const fileInFiltersFolder = file.includes('filters/') || file.includes('filters\\');
    const fileHasTxtExtension = file.endsWith('.txt');

    // "/" for unix-like or "\\" for windows in path.
    const isMv3 = MV3_PLATFORM_DIRS.some((dir) => (
        file.includes(`/${dir}/`) || file.includes(`\\${dir}\\`)
    ));

    if (isMv3) {
        console.log('Skipped generating patch for MV3 extension');
        return false;
    }

    const isAndroidContentBlocker = file.includes('/android-content-blocker/')
        || file.includes('\\android-content-blocker\\');
    if (isAndroidContentBlocker) {
        console.log('Skipped generating patch for android-content-blocker');
        return false;
    }

    // patches are supported by `mac_v2` (or later)
    // but not by `mac` (v1)
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
};

/**
 * Main function to generate and copy patches for filter files.
 */
const main = async (): Promise<void> => {
    // Find all new filter files
    const newFilterFiles = await findFiles(
        FOLDER_WITH_NEW_FILTERS,
        (file: string) => shouldGeneratePatch(file, cliIncludedFilterIDs, cliExcludedFilterIDs),
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

// CLI entrypoint: generate patches when run directly
if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    await main();
}
