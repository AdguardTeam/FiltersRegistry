import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compile } from '@adguard/filters-compiler';
import { CUSTOM_PLATFORMS_CONFIG } from './custom_platforms.js';
import { formatDate } from '../utils/strings.js';
import {
    FOLDER_WITH_NEW_FILTERS,
    FOLDER_WITH_OLD_FILTERS,
} from './constants.js';
import { stripGeneratedMetaFromDir } from './strip-generated-meta.ts';
import { findFiles } from '../utils/find_files.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse command-line parameters -i|--include, -s|--skip, --use-cache, --generate-cache,
 * --no-patches-prepare, --strip-generated-meta
 */
let includedFilterIDs = [];
let excludedFilterIDs = [];
let rawReportPath = '';
let useCache = false;
let generateCache = false;
let noPatchesPrepare = false;
let stripGeneratedMeta = false;

const args = process.argv.slice(2);
args.forEach((val) => {
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

    if (val.startsWith('--report=')) {
        rawReportPath = val.slice(val.indexOf('=') + 1).trim();
    }

    if (val === '--use-cache') {
        useCache = true;
    }

    if (val === '--generate-cache') {
        generateCache = true;
    }

    if (val === '--no-patches-prepare') {
        noPatchesPrepare = true;
    }

    if (val === '--strip-generated-meta') {
        stripGeneratedMeta = true;
    }
});

if (useCache && generateCache) {
    // eslint-disable-next-line no-console
    console.error('Error: --use-cache and --generate-cache are mutually exclusive.');
    process.exit(1);
}

/**
 * Set all relative paths needed for compiler
 */
const filtersDir = path.join(__dirname, '../../filters');
const logPath = path.join(__dirname, '../../log.txt');
const platformsPath = path.join(__dirname, '../..', FOLDER_WITH_NEW_FILTERS);
const copyPlatformsPath = path.join(__dirname, '../..', FOLDER_WITH_OLD_FILTERS);
const cachedFiltersDir = path.join(__dirname, '../../temp/filters_cached');

const reportPath = rawReportPath !== ''
    // report-adguard.txt OR report-third-party.txt
    ? path.join(__dirname, '../..', rawReportPath)
    // report_partial_DD-MM-YYYY_HH-MM-SS.txt
    : path.join(__dirname, '../..', `report_partial_${formatDate(new Date())}.txt`);

const SHADOW_TEMPLATE_CONTENT = '@include "./filter.txt"\n';

/**
 * Prepare a temporary copy of the filters directory with shadow templates.
 *
 * Copies `filters/` → `temp/filters_cached/`, then replaces the content of every
 * `template.txt` with a single-line local include pointing to the cached `filter.txt`.
 * Validates that every filter directory with a `template.txt` also has a `filter.txt`.
 *
 * @returns {Promise<void>}
 */
const prepareCachedFiltersDir = async () => {
    // Remove stale copy if exists
    if (fs.existsSync(cachedFiltersDir)) {
        await fs.promises.rm(cachedFiltersDir, { recursive: true });
    }

    // Full recursive copy
    await fs.promises.cp(filtersDir, cachedFiltersDir, { recursive: true });

    // Find all directories containing template.txt and replace with shadow templates
    const templatePaths = await findFiles(cachedFiltersDir, (p) => path.basename(p) === 'template.txt');

    await Promise.all(templatePaths.map(async (templatePath) => {
        const dir = path.dirname(templatePath);
        const filterTxtPath = path.join(dir, 'filter.txt');

        if (!fs.existsSync(filterTxtPath)) {
            throw new Error(
                `--use-cache: missing filter.txt in ${path.relative(cachedFiltersDir, dir)}. `
                + 'Run "yarn generate-cache" first to generate cached filter files.',
            );
        }

        await fs.promises.writeFile(templatePath, SHADOW_TEMPLATE_CONTENT, 'utf8');
    }));

    // eslint-disable-next-line no-console
    console.log(`Prepared cached filters directory with ${templatePaths.length} shadow templates.`);
};

/**
 * Compiler entry point.
 */
const buildFilters = async () => {
    // When --generate-cache we only need to compile filters (which updates filter.txt),
    // skip platform generation, patches preparation, and temp/platforms copying.
    if (generateCache) {
        await compile(
            filtersDir,
            logPath,
            reportPath,
            null, // null ⇒ generate() inside compiler returns early, no platform files
            includedFilterIDs,
            excludedFilterIDs,
            CUSTOM_PLATFORMS_CONFIG,
        );
        return;
    }

    // Clean temporary folder
    if (fs.existsSync(copyPlatformsPath)) {
        await fs.promises.rm(copyPlatformsPath, { recursive: true });
    }

    // Checks if this is the initial run of the compiler by verifying
    // the existence of platform files.
    let initialRun = false;
    if (!fs.existsSync(platformsPath)) {
        initialRun = true;
    } else if (!noPatchesPrepare) {
        // Make copy for future patches generation
        await fs.promises.cp(platformsPath, copyPlatformsPath, { recursive: true });
    }

    // Determine which filtersDir to pass to the compiler
    const effectiveFiltersDir = useCache ? cachedFiltersDir : filtersDir;

    if (useCache) {
        await prepareCachedFiltersDir();
    }

    try {
        await compile(
            effectiveFiltersDir,
            logPath,
            reportPath,
            platformsPath,
            includedFilterIDs,
            excludedFilterIDs,
            CUSTOM_PLATFORMS_CONFIG,
        );
    } finally {
        // Clean up temp filters copy
        if (useCache && fs.existsSync(cachedFiltersDir)) {
            await fs.promises.rm(cachedFiltersDir, { recursive: true });
        }
    }

    // For the very first run, we should copy the built platforms into
    // the temp folder to create the first empty patches for future versions
    if (initialRun && !noPatchesPrepare) {
        // Make copy for future patches generation
        await fs.promises.cp(platformsPath, copyPlatformsPath, { recursive: true });
    }

    // Strip generated metadata (Checksum, Diff-Path, TimeUpdated, Version)
    // from compiled filter files so they don't pollute diff comparisons.
    if (stripGeneratedMeta) {
        const count = await stripGeneratedMetaFromDir(platformsPath);
        // eslint-disable-next-line no-console
        console.log(`Stripped generated meta from ${count} file(s).`);
    }
};

buildFilters();
