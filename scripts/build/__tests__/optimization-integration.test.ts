import {
    describe, it, vi, expect, beforeEach, afterEach, beforeAll, afterAll,
} from 'vitest';
import { compile, localOptimizationStatistics, OptimizationStatsError } from '@adguard/filters-compiler';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { findFiles } from '../../utils/find_files.js';
import { scopeFlagsFor } from '../build-config.js';

const unscopedFlags = scopeFlagsFor([], []);

const mockFsPromises = (overrides: Record<string, unknown> = {}): { default: Record<string, unknown> } => ({
    default: {
        cp: vi.fn().mockResolvedValue(undefined),
        rm: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const expectedOptimizationStatsBasePath = path.resolve(__dirname, '../../../temp/optimization/stats');
const expectedPercentOptions = { percentPath: path.resolve(__dirname, '../../../optimization_config.json') };

const EMPTY_FILTER_IDS = Object.freeze([]);
const FILTER_ID = 1;

/**
 * Imports build.ts with `process.exit` and `console.error` stubbed, and waits
 * for it to exit with code 1.
 *
 * @returns Everything build.ts printed through `console.error`, joined by newlines.
 */
const importBuildExpectingFailure = async (): Promise<string> => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    try {
        await import('../build.js');

        await vi.waitFor(() => {
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        return consoleErrorSpy.mock.calls.map(([message]) => String(message)).join('\n');
    } finally {
        consoleErrorSpy.mockRestore();
        exitSpy.mockRestore();
    }
};

describe('build.ts: cache flag handling', () => {
    const originalArgv = process.argv;

    beforeEach(() => {
        vi.resetModules();
        vi.doMock('@adguard/filters-compiler', () => ({
            compile: vi.fn().mockResolvedValue(undefined),
            localOptimizationStatistics: {
                download: vi.fn().mockResolvedValue(undefined),
                use: vi.fn(),
                reset: vi.fn().mockResolvedValue(undefined),
            },
        }));
        vi.doMock('fs', () => ({
            existsSync: vi.fn().mockReturnValue(false),
        }));
        vi.doMock('fs/promises', () => mockFsPromises());
        vi.doMock('../../utils/find_files.js', () => ({
            findFiles: vi.fn().mockResolvedValue([]),
        }));
    });

    afterEach(() => {
        process.argv = originalArgv;
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('--generate-cache: compiles with null platformsPath, does not touch optimization stats', async () => {
        process.argv = ['node', 'build.js', '--generate-cache'];
        await import('../build.js');

        const {
            compile: mockedCompile,
            localOptimizationStatistics: mockedStats,
        } = await import('@adguard/filters-compiler');
        await vi.waitFor(() => {
            expect(vi.mocked(mockedCompile)).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                expect.any(String),
                null,
                EMPTY_FILTER_IDS,
                EMPTY_FILTER_IDS,
                expect.anything(),
            );
        });
        expect(vi.mocked(mockedStats.download)).not.toHaveBeenCalled();
        expect(vi.mocked(mockedStats.use)).not.toHaveBeenCalled();
    });

    it(`--generate-cache --include=${FILTER_ID}: compiles scoped to filter ${FILTER_ID}`, async () => {
        process.argv = ['node', 'build.js', '--generate-cache', `--include=${FILTER_ID}`];
        await import('../build.js');

        const { compile: mockedCompile } = await import('@adguard/filters-compiler');
        await vi.waitFor(() => {
            expect(vi.mocked(mockedCompile)).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                expect.any(String),
                null,
                [FILTER_ID],
                EMPTY_FILTER_IDS,
                expect.anything(),
            );
        });
    });

    it.each([
        ['downloads stats for all filters, compile skipped', {
            args: [],
            includedFilterIds: EMPTY_FILTER_IDS,
            excludedFilterIds: EMPTY_FILTER_IDS,
        }],
        [`with --include=${FILTER_ID} downloads stats only for that filter`, {
            args: [`--include=${FILTER_ID}`],
            includedFilterIds: [FILTER_ID],
            excludedFilterIds: EMPTY_FILTER_IDS,
        }],
        [`with --skip=${FILTER_ID} downloads stats for every other filter`, {
            args: [`--skip=${FILTER_ID}`],
            includedFilterIds: EMPTY_FILTER_IDS,
            excludedFilterIds: [FILTER_ID],
        }],
    ])(
        '--download-stats %s',
        async (_, { args, includedFilterIds, excludedFilterIds }) => {
            process.argv = ['node', 'build.js', '--download-stats', ...args];
            await import('../build.js');

            const {
                compile: mockedCompile,
                localOptimizationStatistics: mockedStats,
            } = await import('@adguard/filters-compiler');

            await vi.waitFor(() => {
                expect(vi.mocked(mockedStats.download))
                    .toHaveBeenCalledWith(
                        expectedOptimizationStatsBasePath,
                        includedFilterIds,
                        excludedFilterIds,
                        expectedPercentOptions,
                    );
            });
            expect(vi.mocked(mockedCompile)).not.toHaveBeenCalled();
        },
    );

    it('--download-stats failure: names optimization_config.json and keeps the original message', async () => {
        const downloadError = new Error('curl failed: 404 for filters/9999/stats.json');
        const { localOptimizationStatistics: mockedStats } = await import('@adguard/filters-compiler');
        vi.mocked(mockedStats.download).mockRejectedValueOnce(downloadError);
        process.argv = ['node', 'build.js', '--download-stats'];

        const errorOutput = await importBuildExpectingFailure();

        expect(errorOutput).toContain('optimization_config.json');
        expect(errorOutput).toContain(downloadError.message);
    });

    it.each([
        ['--use-cache', ['--use-cache']],
        ['plain build', []],
    ])('%s without a cached local optimization: compiles, does not call use()', async (_, args) => {
        // default beforeEach mock already makes existsSync() return false everywhere
        process.argv = ['node', 'build.js', ...args];
        await import('../build.js');

        const {
            compile: mockedCompile,
            localOptimizationStatistics: mockedStats,
        } = await import('@adguard/filters-compiler');
        await vi.waitFor(() => {
            expect(vi.mocked(mockedCompile)).toHaveBeenCalled();
        });
        expect(vi.mocked(mockedStats.use)).not.toHaveBeenCalled();
        expect(vi.mocked(mockedStats.download)).not.toHaveBeenCalled();
    });

    it('--use-cache with a cached local optimization: calls use() before compiling', async () => {
        vi.doMock('fs', () => ({
            existsSync: vi.fn().mockReturnValue(true),
        }));
        vi.doMock('fs/promises', () => mockFsPromises({
            readdir: vi.fn().mockResolvedValue([String(FILTER_ID)]),
            readFile: vi.fn().mockResolvedValue(unscopedFlags),
        }));
        process.argv = ['node', 'build.js', '--use-cache'];
        await import('../build.js');

        const {
            compile: mockedCompile,
            localOptimizationStatistics: mockedStats,
        } = await import('@adguard/filters-compiler');
        await vi.waitFor(() => {
            expect(vi.mocked(mockedCompile)).toHaveBeenCalled();
        });
        expect(vi.mocked(mockedStats.use)).toHaveBeenCalledWith(
            expectedOptimizationStatsBasePath,
            expectedPercentOptions,
        );
        expect(vi.mocked(mockedStats.download)).not.toHaveBeenCalled();
    });

    it('plain build with a cached local optimization present: does not call use(), fetches remotely', async () => {
        // build.ts only applies a local stats cache under --use-cache; a
        // plain build must ignore it even when a matching cache exists.
        vi.doMock('fs', () => ({
            existsSync: vi.fn().mockReturnValue(true),
        }));
        vi.doMock('fs/promises', () => mockFsPromises({
            readdir: vi.fn().mockResolvedValue([String(FILTER_ID)]),
            readFile: vi.fn().mockResolvedValue(unscopedFlags),
        }));
        process.argv = ['node', 'build.js'];
        await import('../build.js');

        const {
            compile: mockedCompile,
            localOptimizationStatistics: mockedStats,
        } = await import('@adguard/filters-compiler');
        await vi.waitFor(() => {
            expect(vi.mocked(mockedCompile)).toHaveBeenCalled();
        });
        expect(vi.mocked(mockedStats.use)).not.toHaveBeenCalled();
        expect(vi.mocked(mockedStats.download)).not.toHaveBeenCalled();
    });

    it('cached stats downloaded under a different filter selection: falls back to remote, no use()', async () => {
        const differentScopeFlags = scopeFlagsFor([FILTER_ID + 1], []);

        vi.doMock('fs', () => ({
            existsSync: vi.fn().mockReturnValue(true),
        }));
        vi.doMock('fs/promises', () => mockFsPromises({
            readdir: vi.fn().mockResolvedValue([String(FILTER_ID)]),
            readFile: vi.fn().mockResolvedValue(differentScopeFlags),
        }));

        process.argv = ['node', 'build.js', '--use-cache'];
        await import('../build.js');

        const {
            compile: mockedCompile,
            localOptimizationStatistics: mockedStats,
        } = await import('@adguard/filters-compiler');
        await vi.waitFor(() => {
            expect(vi.mocked(mockedCompile)).toHaveBeenCalled();
        });
        expect(vi.mocked(mockedStats.use)).not.toHaveBeenCalled();
    });

    it('cached local optimization stats downloaded for all filters: calls use() even for a scoped build', async () => {
        vi.doMock('fs', () => ({
            existsSync: vi.fn().mockReturnValue(true),
        }));
        vi.doMock('fs/promises', () => mockFsPromises({
            readdir: vi.fn().mockResolvedValue([String(FILTER_ID)]),
            readFile: vi.fn().mockResolvedValue(unscopedFlags),
        }));
        process.argv = ['node', 'build.js', '--use-cache', `--include=${FILTER_ID}`];
        await import('../build.js');

        const {
            compile: mockedCompile,
            localOptimizationStatistics: mockedStats,
        } = await import('@adguard/filters-compiler');
        await vi.waitFor(() => {
            expect(vi.mocked(mockedCompile)).toHaveBeenCalled();
        });
        expect(vi.mocked(mockedStats.use)).toHaveBeenCalledWith(
            expectedOptimizationStatsBasePath,
            expectedPercentOptions,
        );
    });

    it('stats dir exists but its filters/ subfolder is missing: falls back to remote, does not crash', async () => {
        // Only the base stats dir "exists"; the nested filters/ subfolder
        // readdir() actually reads does not. Guards against reintroducing an
        // unguarded readdir() on a path existsSync() never checked.
        vi.doMock('fs', () => ({
            existsSync: vi.fn((checkedPath: string) => checkedPath === expectedOptimizationStatsBasePath),
        }));
        process.argv = ['node', 'build.js', '--use-cache'];
        await import('../build.js');

        const {
            compile: mockedCompile,
            localOptimizationStatistics: mockedStats,
        } = await import('@adguard/filters-compiler');
        await vi.waitFor(() => {
            expect(vi.mocked(mockedCompile)).toHaveBeenCalled();
        });
        expect(vi.mocked(mockedStats.use)).not.toHaveBeenCalled();
    });

    it('--use-cache with missing stats.json: printing the --download-stats hint and original message', async () => {
        vi.doMock('fs', () => ({
            existsSync: vi.fn().mockReturnValue(true),
        }));
        vi.doMock('fs/promises', () => mockFsPromises({
            readdir: vi.fn().mockResolvedValue([String(FILTER_ID)]),
            readFile: vi.fn().mockResolvedValue(unscopedFlags),
        }));

        const VIRTUAL_STATS_PATH = path.join('/', 'tmp', 'stats.json');

        const retrieveStatsError = new OptimizationStatsError(FILTER_ID, VIRTUAL_STATS_PATH, 'retrieval');

        vi.doMock('@adguard/filters-compiler', () => ({
            compile: vi.fn().mockRejectedValue(retrieveStatsError),
            localOptimizationStatistics: {
                download: vi.fn().mockResolvedValue(undefined),
                use: vi.fn(),
                reset: vi.fn().mockResolvedValue(undefined),
            },
            OptimizationStatsError,
        }));
        process.argv = ['node', 'build.js', '--use-cache'];

        const errorOutput = await importBuildExpectingFailure();

        expect(errorOutput).toContain(
            `Run --download-stats to download the latest statistics. (${retrieveStatsError.message})`,
        );
    });

    it('--use-cache with invalid (not missing) stats.json: printing the validation-specific hint', async () => {
        vi.doMock('fs', () => ({
            existsSync: vi.fn().mockReturnValue(true),
        }));

        const VIRTUAL_STATS_PATH = path.join('/', 'tmp', 'stats.json');

        const invalidStatsError = new OptimizationStatsError(FILTER_ID, VIRTUAL_STATS_PATH, 'validation');

        vi.doMock('@adguard/filters-compiler', () => ({
            compile: vi.fn().mockRejectedValue(invalidStatsError),
            localOptimizationStatistics: {
                download: vi.fn().mockResolvedValue(undefined),
                use: vi.fn(),
                reset: vi.fn().mockResolvedValue(undefined),
            },
            OptimizationStatsError,
        }));
        process.argv = ['node', 'build.js', '--use-cache'];

        const errorOutput = await importBuildExpectingFailure();

        expect(errorOutput).toContain(
            'The cached optimization stats are invalid. Inspect the file, or run '
            + `--download-stats to try refreshing it from the remote server. (${invalidStatsError.message})`,
        );
        expect(errorOutput).not.toContain('Run --download-stats to download the latest statistics.');
    });
});

const REAL_FILTER_DIR = path.resolve(__dirname, 'resources/filter_test');

const RULE_TO_FILTER = '||e2e-optimization-filtered.example^';
const RULE_TO_KEEP = '||e2e-optimization-kept.example^';

const TEST_PLATFORM_CONFIG: Record<string, Record<string, unknown>> = {
    TEST: {
        platform: 'test',
        path: 'test',
        configuration: {
            ignoreRuleHints: false,
            replacements: null,
        },
        defines: {
            adguard: true,
        },
    },
};

describe('localOptimizationStatistics: rules optimized from local cache', () => {
    let tmpDir: string;
    let curlLogPath: string;
    let originalPath: string | undefined;
    let optimizationStatsBasePath: string;
    let allOutput: string;
    let statsContentBefore: string;

    beforeAll(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'filters-e2e-optimized-rules-'));

        // The compiler downloads through `curl`. Put a failing curl first on PATH and
        // log its calls, so the test proves no remote request (percent.json or
        // stats.json) is made when percentPath is set — even with network access.
        const curlShimDir = path.join(tmpDir, 'bin');
        curlLogPath = path.join(tmpDir, 'curl-calls.log');
        await fs.mkdir(curlShimDir, { recursive: true });
        await fs.writeFile(
            path.join(curlShimDir, 'curl'),
            `#!/bin/sh\necho "$@" >> "${curlLogPath}"\nexit 22\n`,
            { mode: 0o755 },
        );
        originalPath = process.env.PATH;
        process.env.PATH = `${curlShimDir}${path.delimiter}${originalPath ?? ''}`;

        const filtersDir = path.join(tmpDir, 'filters');
        optimizationStatsBasePath = path.join(tmpDir, 'optimization', 'stats');
        const platformsDir = path.join(tmpDir, 'platforms');
        const logPath = path.join(tmpDir, 'log.txt');
        const reportPath = path.join(tmpDir, 'report.txt');

        const filterDir = path.join(filtersDir, 'filter_1_Russian');
        await fs.mkdir(filterDir, { recursive: true });

        await fs.copyFile(path.join(REAL_FILTER_DIR, 'metadata.json'), path.join(filterDir, 'metadata.json'));
        await fs.copyFile(path.join(REAL_FILTER_DIR, 'revision.json'), path.join(filterDir, 'revision.json'));

        await fs.writeFile(
            path.join(filterDir, 'template.txt'),
            `! Title: E2E Optimization Test\n${RULE_TO_FILTER}\n${RULE_TO_KEEP}\n`,
            'utf-8',
        );

        const statsDir = path.join(optimizationStatsBasePath, 'filters', String(FILTER_ID));
        await fs.mkdir(statsDir, { recursive: true });

        // Injected via percentPath, so compile() makes no network request for percent.json.
        const percentPath = path.join(tmpDir, 'optimization_config.json');
        await fs.writeFile(percentPath, JSON.stringify([{ filterId: FILTER_ID, percent: 40 }]), 'utf-8');

        const statsJson = JSON.stringify({
            percent: 40,
            minPercent: 25,
            maxPercent: 50,
            strict: true,
            groups: [
                {
                    config: { type: 'BASIC', scope: 'GENERIC', hits: 1 },
                    rules: {
                        [RULE_TO_FILTER]: 0,
                        [RULE_TO_KEEP]: 9999,
                    },
                },
            ],
        });
        const statsPath = path.join(statsDir, 'stats.json');
        await fs.writeFile(statsPath, statsJson, 'utf-8');
        statsContentBefore = statsJson;

        localOptimizationStatistics.use(optimizationStatsBasePath, { percentPath });

        await compile(filtersDir, logPath, reportPath, platformsDir, [FILTER_ID], [], TEST_PLATFORM_CONFIG);

        const outputFiles: string[] = await findFiles(platformsDir, () => true);
        const optimizedFiles = outputFiles.filter((f) => f.endsWith('_optimized.txt'));
        expect(optimizedFiles.length).toBeGreaterThan(0);
        allOutput = (await Promise.all(optimizedFiles.map(async (f) => fs.readFile(f, 'utf-8')))).join('\n');
    }, 30_000);

    it('makes no remote request: percent.json comes from percentPath', async () => {
        const curlCalls = await fs.readFile(curlLogPath, 'utf-8').catch(() => '');
        expect(curlCalls).toBe('');
    });

    it('local stats.json is not modified by compile', async () => {
        const statsPath = path.join(optimizationStatsBasePath, 'filters', String(FILTER_ID), 'stats.json');
        const statsContentAfter = await fs.readFile(statsPath, 'utf-8');
        expect(statsContentAfter).toBe(statsContentBefore);
    });

    it('rule with 0 hits is absent in compiled output', () => {
        expect(allOutput).not.toContain(RULE_TO_FILTER);
    });

    it('rule with 9999 hits is present in compiled output', () => {
        expect(allOutput).toContain(RULE_TO_KEEP);
    });

    afterAll(async () => {
        process.env.PATH = originalPath;
        await localOptimizationStatistics.reset(optimizationStatsBasePath);
        await fs.rm(tmpDir, { recursive: true, force: true });
    });
});
