import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compile, localOptimizationConfig } from '@adguard/filters-compiler';
import { CUSTOM_PLATFORMS_CONFIG } from './custom_platforms.js';
import { formatDate } from '../utils/strings.js';
import { FOLDER_WITH_NEW_FILTERS, FOLDER_WITH_OLD_FILTERS } from './constants.js';
// eslint-disable-next-line import/no-unresolved
import { parseFlags, validateFlags, validateArgs } from './build-config.ts';
import { stripGeneratedMetaFromDir } from './strip-generated-meta.ts';
import { findFiles } from '../utils/find_files.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse and validate command-line parameters
 */
const args = process.argv.slice(2);
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const argsError = validateArgs(args);
if (argsError) {
    // eslint-disable-next-line no-console
    console.error(`${red(argsError)}\n`);
    process.exit(1);
}

const flags = parseFlags(args);
const validationResult = validateFlags(flags);

if (validationResult) {
    // eslint-disable-next-line no-console
    if (validationResult.type === 'error') {
        // eslint-disable-next-line no-console
        console.error(`\n${red(validationResult.message)}\n`);
        process.exit(1);
    }
}

const {
    includedFilterIDs,
    excludedFilterIDs,
    rawReportPath,
    useCache,
    generateCache,
    generateStatsFromCachedPercentJson,
    noPatchesPrepare,
    stripGeneratedMeta,
} = flags;

/**
 * Set all relative paths needed for compiler
 */
const filtersDir = path.join(__dirname, '../../filters');
const logPath = path.join(__dirname, '../../log.txt');
const platformsPath = path.join(__dirname, '../..', FOLDER_WITH_NEW_FILTERS);
const copyPlatformsPath = path.join(__dirname, '../..', FOLDER_WITH_OLD_FILTERS);
const tempDir = path.join(__dirname, '../../temp');
const cachedFiltersDir = path.join(tempDir, 'filters_cached');
const localOptimizationConfigPath = path.join(tempDir, 'optimization_config');

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
    // When --generate-cache, download percent.json and per-filter stats.json to
    // the local optimization config directory, then exit early.
    if (generateCache) {
        await fs.promises.rm(localOptimizationConfigPath, { recursive: true, force: true });

        await localOptimizationConfig.downloadPercentJson(localOptimizationConfigPath);
        // eslint-disable-next-line no-console
        console.log(`percent.json saved to ${localOptimizationConfigPath}.`);

        await localOptimizationConfig.downloadStatsFromPercentJson(localOptimizationConfigPath, includedFilterIDs);

        // eslint-disable-next-line no-console
        console.log(`Optimization config cached to ${localOptimizationConfigPath}.`);
        return;
    }

    if (generateStatsFromCachedPercentJson) {
        await localOptimizationConfig.downloadStatsFromPercentJson(localOptimizationConfigPath, includedFilterIDs);
        // eslint-disable-next-line no-console
        console.log(`Stats generated from cached percent.json at ${localOptimizationConfigPath}.`);
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
        localOptimizationConfig.useLocalConfig(localOptimizationConfigPath);
        // eslint-disable-next-line no-console
        console.log(`Using local optimization config from: ${localOptimizationConfigPath}`);
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
        const newCount = await stripGeneratedMetaFromDir(platformsPath);
        // eslint-disable-next-line no-console
        console.log(`Stripped generated meta from ${newCount} new file(s).`);

        // Also strip the old baseline copy so build:patches diffs
        // consistently-stripped content.
        if (fs.existsSync(copyPlatformsPath)) {
            const oldCount = await stripGeneratedMetaFromDir(copyPlatformsPath);
            // eslint-disable-next-line no-console
            console.log(`Stripped generated meta from ${oldCount} old baseline file(s).`);
        }
    }
};

buildFilters();
