import {
    describe, it, vi, expect, beforeEach, afterEach, beforeAll, afterAll,
} from 'vitest';
import { compile, localOptimizationStatistics } from '@adguard/filters-compiler';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { findFiles } from '../../utils/find_files.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const expectedLocalOptimizationConfigPath = path.resolve(__dirname, '../../../temp/optimization_config');

const EMPTY_FILTER_IDS = Object.freeze([]);
const FILTER_ID = 1;

describe('build.js: cache flag handling', () => {
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
        vi.doMock('fs/promises', () => ({
            default: {
                cp: vi.fn().mockResolvedValue(undefined),
                rm: vi.fn().mockResolvedValue(undefined),
                writeFile: vi.fn().mockResolvedValue(undefined),
            },
        }));
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

    it('--download-stats: downloads stats for all filters, compile skipped', async () => {
        process.argv = ['node', 'build.js', '--download-stats'];
        await import('../build.js');

        const {
            compile: mockedCompile,
            localOptimizationStatistics: mockedStats,
        } = await import('@adguard/filters-compiler');
        await vi.waitFor(() => {
            expect(vi.mocked(mockedStats.download)).toHaveBeenCalledWith(
                expectedLocalOptimizationConfigPath,
                undefined,
            );
        });
        expect(vi.mocked(mockedCompile)).not.toHaveBeenCalled();
    });

    it(`--download-stats --include=${FILTER_ID}: scopes stats download to filter ${FILTER_ID}`, async () => {
        process.argv = ['node', 'build.js', '--download-stats', `--include=${FILTER_ID}`];
        await import('../build.js');

        const {
            compile: mockedCompile,
            localOptimizationStatistics: mockedStats,
        } = await import('@adguard/filters-compiler');
        await vi.waitFor(() => {
            expect(vi.mocked(mockedStats.download)).toHaveBeenCalledWith(
                expectedLocalOptimizationConfigPath,
                [FILTER_ID],
            );
        });
        expect(vi.mocked(mockedCompile)).not.toHaveBeenCalled();
    });

    it('--use-cache without a local optimization cache: compiles, does not call use()', async () => {
        // default beforeEach mock already makes existsSync() return false everywhere
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
        expect(vi.mocked(mockedStats.download)).not.toHaveBeenCalled();
    });

    it('--use-cache with a local optimization cache: calls use() before compiling', async () => {
        vi.doMock('fs', () => ({
            existsSync: vi.fn().mockReturnValue(true),
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
        expect(vi.mocked(mockedStats.use)).toHaveBeenCalledWith(expectedLocalOptimizationConfigPath);
        expect(vi.mocked(mockedStats.download)).not.toHaveBeenCalled();
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
    let optimizationDir: string;
    let allOutput: string;
    let statsContentBefore: string;

    beforeAll(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'filters-e2e-genstats-'));

        const filtersDir = path.join(tmpDir, 'filters');
        optimizationDir = path.join(tmpDir, 'optimization_config');
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

        const statsDir = path.join(optimizationDir, 'filters', String(FILTER_ID));
        await fs.mkdir(statsDir, { recursive: true });

        // percent.json is never read from disk (always fetched from the remote
        // server, even in local mode), so it's not written here. This test
        // therefore depends on the real network and on filter 1 actually being
        // listed in the live remote percent.json.
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

        localOptimizationStatistics.use(optimizationDir);

        await compile(filtersDir, logPath, reportPath, platformsDir, [FILTER_ID], [], TEST_PLATFORM_CONFIG);

        const outputFiles: string[] = await findFiles(platformsDir, () => true);
        const optimizedFiles = outputFiles.filter((f) => f.endsWith('_optimized.txt'));
        expect(optimizedFiles.length).toBeGreaterThan(0);
        allOutput = (await Promise.all(optimizedFiles.map(async (f) => fs.readFile(f, 'utf-8')))).join('\n');
    }, 30_000);

    it('local stats.json is not modified by compile', async () => {
        const statsPath = path.join(tmpDir, 'optimization_config', 'filters', String(FILTER_ID), 'stats.json');
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
        await localOptimizationStatistics.reset(optimizationDir);
        await fs.rm(tmpDir, { recursive: true, force: true });
    });
});
