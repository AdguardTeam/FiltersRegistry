/* eslint-disable no-console */
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { compile, localOptimizationStatistics, OptimizationStatsError } from '@adguard/filters-compiler';
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
    console.error(`${red(argsError)}\n`);
    process.exit(1);
}

const flags = parseFlags(args);
const validationResult = validateFlags(flags);

if (validationResult) {
    if (validationResult.type === 'error') {
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
    downloadStats,
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
const optimizationStatsDir = path.join(tempDir, 'optimization', 'stats');

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
    await fs.rm(cachedFiltersDir, { recursive: true, force: true });

    // Full recursive copy
    await fs.cp(filtersDir, cachedFiltersDir, { recursive: true });

    // Find all directories containing template.txt and replace with shadow templates
    const templatePaths = await findFiles(cachedFiltersDir, (p) => path.basename(p) === 'template.txt');

    await Promise.all(templatePaths.map(async (templatePath) => {
        const dir = path.dirname(templatePath);
        const filterTxtPath = path.join(dir, 'filter.txt');

        if (!existsSync(filterTxtPath)) {
            throw new Error(
                `--use-cache: missing filter.txt in ${path.relative(cachedFiltersDir, dir)}. `
                + 'Run "yarn generate-cache" first to generate cached filter files.',
            );
        }

        await fs.writeFile(templatePath, SHADOW_TEMPLATE_CONTENT, 'utf8');
    }));

    console.log(`Prepared cached filters directory with ${templatePaths.length} shadow templates.`);
};

/**
 * Compiler entry point.
 */
const buildFilters = async () => {
    // --generate-cache compiles filter templates only, writing filter.txt to each
    // filters/<id>/ directory. Passing null as platformsPath skips platform file
    // generation entirely. It no longer touches optimization stats — use
    // --download-stats for that.
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

    if (downloadStats) {
        await localOptimizationStatistics.download(
            optimizationStatsDir,
            includedFilterIDs,
            excludedFilterIDs,
        );
        console.log(`Optimization statistics downloaded at ${optimizationStatsDir}.`);
        return;
    }

    // Clean temporary folder
    await fs.rm(copyPlatformsPath, { recursive: true, force: true });

    // Checks if this is the initial run of the compiler by verifying
    // the existence of platform files.
    let initialRun = false;
    if (!existsSync(platformsPath)) {
        initialRun = true;
    } else if (!noPatchesPrepare) {
        // Make copy for future patches generation
        await fs.cp(platformsPath, copyPlatformsPath, { recursive: true });
    }

    // Determine which filtersDir to pass to the compiler
    const effectiveFiltersDir = useCache ? cachedFiltersDir : filtersDir;

    if (useCache) {
        await prepareCachedFiltersDir();

        // If a local optimization stats cache exists, use it; otherwise fall back
        // to fetching stats from the remote server (localOptimizationStatistics.use()
        // simply isn't called in that case — that's already getOptimizationStatistics's
        // default behavior).
        if (existsSync(optimizationStatsDir)) {
            localOptimizationStatistics.use(optimizationStatsDir);
            console.log(`Using local optimization statistics from: ${optimizationStatsDir}`);
        } else {
            console.log('No local optimization statistics found; fetching stats from the remote server.');
        }
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
    } catch (error) {
        if (useCache && error instanceof OptimizationStatsError) {
            throw new Error(
                `Run --download-stats to download the latest statistics. (${error.message})`,
                { cause: error },
            );
        }
        throw error;
    } finally {
        // Clean up temp filters copy
        if (useCache) {
            await fs.rm(cachedFiltersDir, { recursive: true, force: true });
        }
    }

    // For the very first run, we should copy the built platforms into
    // the temp folder to create the first empty patches for future versions
    if (initialRun && !noPatchesPrepare) {
        // Make copy for future patches generation
        await fs.cp(platformsPath, copyPlatformsPath, { recursive: true });
    }

    // Strip generated metadata (Checksum, Diff-Path, TimeUpdated, Version)
    // from compiled filter files so they don't pollute diff comparisons.
    if (stripGeneratedMeta) {
        const newCount = await stripGeneratedMetaFromDir(platformsPath);
        console.log(`Stripped generated meta from ${newCount} new file(s).`);

        // Also strip the old baseline copy so build:patches diffs
        // consistently-stripped content.
        if (existsSync(copyPlatformsPath)) {
            const oldCount = await stripGeneratedMetaFromDir(copyPlatformsPath);
            console.log(`Stripped generated meta from ${oldCount} old baseline file(s).`);
        }
    }
};

buildFilters().catch((e) => {
    console.error(red(e.message));
    process.exit(1);
});
