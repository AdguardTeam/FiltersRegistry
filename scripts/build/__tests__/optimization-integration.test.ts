import {
    describe, it, vi, expect, beforeEach, afterEach, beforeAll, afterAll,
} from 'vitest';
import { compile, localOptimizationConfig } from '@adguard/filters-compiler';
import os from 'os';
import path from 'path';
import fs from 'fs';
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
            localOptimizationConfig: {
                downloadPercentJson: vi.fn().mockResolvedValue(undefined),
                downloadStatsFromPercentJson: vi.fn().mockResolvedValue(undefined),
                useLocalConfig: vi.fn(),
            },
        }));
        vi.doMock('fs', () => ({
            default: {
                existsSync: vi.fn().mockReturnValue(false),
                promises: {
                    cp: vi.fn().mockResolvedValue(undefined),
                    rm: vi.fn().mockResolvedValue(undefined),
                    writeFile: vi.fn().mockResolvedValue(undefined),
                },
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

    it('--use-cache: compile runs, no optimization downloads before', async () => {
        process.argv = ['node', 'build.js', '--use-cache'];
        await import('../build.js');

        const {
            compile: mockedCompile,
            localOptimizationConfig: mockedLocalOptimizationConfig,
        } = await import('@adguard/filters-compiler');
        await vi.waitFor(() => {
            expect(vi.mocked(mockedCompile)).toHaveBeenCalled();
        });
        expect(vi.mocked(mockedLocalOptimizationConfig.downloadPercentJson)).not.toHaveBeenCalled();
        expect(vi.mocked(mockedLocalOptimizationConfig.downloadStatsFromPercentJson)).not.toHaveBeenCalled();
        expect(vi.mocked(mockedLocalOptimizationConfig.useLocalConfig)).toHaveBeenCalled();
    });

    it('--generate-cache: downloads percent.json and stats, compile skipped', async () => {
        process.argv = ['node', 'build.js', '--generate-cache'];
        await import('../build.js');

        const {
            compile: mockedCompile,
            localOptimizationConfig: mockedLocalOptimizationConfig,
        } = await import('@adguard/filters-compiler');
        await vi.waitFor(() => {
            expect(vi.mocked(mockedLocalOptimizationConfig.downloadPercentJson)).toHaveBeenCalledWith(
                expectedLocalOptimizationConfigPath,
            );
            expect(vi.mocked(mockedLocalOptimizationConfig.downloadStatsFromPercentJson)).toHaveBeenCalledWith(
                expectedLocalOptimizationConfigPath,
                EMPTY_FILTER_IDS,
            );
        });
        expect(vi.mocked(mockedCompile)).not.toHaveBeenCalled();
    });

    it(`--generate-cache --include=${FILTER_ID}: scopes stats download to filter ${FILTER_ID}`, async () => {
        process.argv = ['node', 'build.js', '--generate-cache', `--include=${FILTER_ID}`];
        await import('../build.js');

        const {
            compile: mockedCompile,
            localOptimizationConfig: mockedLocalOptimizationConfig,
        } = await import('@adguard/filters-compiler');
        await vi.waitFor(() => {
            expect(vi.mocked(mockedLocalOptimizationConfig.downloadStatsFromPercentJson)).toHaveBeenCalledWith(
                expectedLocalOptimizationConfigPath,
                [FILTER_ID],
            );
        });
        expect(vi.mocked(mockedCompile)).not.toHaveBeenCalled();
    });

    it('--generate-stats-from-cached-percent-json: downloads stats only, compile skipped', async () => {
        process.argv = ['node', 'build.js', '--generate-stats-from-cached-percent-json'];
        await import('../build.js');

        const {
            compile: mockedCompile,
            localOptimizationConfig: mockedLocalOptimizationConfig,
        } = await import('@adguard/filters-compiler');
        await vi.waitFor(() => {
            expect(vi.mocked(mockedLocalOptimizationConfig.downloadStatsFromPercentJson)).toHaveBeenCalledWith(
                expectedLocalOptimizationConfigPath,
                EMPTY_FILTER_IDS,
            );
        });
        expect(vi.mocked(mockedLocalOptimizationConfig.downloadPercentJson)).not.toHaveBeenCalled();
        expect(vi.mocked(mockedCompile)).not.toHaveBeenCalled();
    });

    it(`--generate-stats-from-cached-percent-json --include=${FILTER_ID}:`
        + ` scopes stats download to filter ${FILTER_ID}`, async () => {
        process.argv = ['node', 'build.js', '--generate-stats-from-cached-percent-json',
            `--include=${FILTER_ID}`];
        await import('../build.js');

        const {
            compile: mockedCompile,
            localOptimizationConfig: mockedLocalOptimizationConfig,
        } = await import('@adguard/filters-compiler');
        await vi.waitFor(() => {
            expect(vi.mocked(mockedLocalOptimizationConfig.downloadStatsFromPercentJson)).toHaveBeenCalledWith(
                expectedLocalOptimizationConfigPath,
                [FILTER_ID],
            );
        });
        expect(vi.mocked(mockedLocalOptimizationConfig.downloadPercentJson)).not.toHaveBeenCalled();
        expect(vi.mocked(mockedCompile)).not.toHaveBeenCalled();
    });

    it('--use-cache with local cache: loads stats for all filters when no --include', async () => {
        vi.doMock('fs', () => ({
            default: {
                existsSync: vi.fn().mockImplementation((p: string) => p.endsWith('percent.json')),
                promises: {
                    cp: vi.fn().mockResolvedValue(undefined),
                    rm: vi.fn().mockResolvedValue(undefined),
                    writeFile: vi.fn().mockResolvedValue(undefined),
                },
            },
        }));
        process.argv = ['node', 'build.js', '--use-cache'];
        await import('../build.js');

        const {
            compile: mockedCompile,
            localOptimizationConfig: mockedLocalOptimizationConfig,
        } = await import('@adguard/filters-compiler');
        await vi.waitFor(() => {
            expect(vi.mocked(mockedCompile)).toHaveBeenCalled();
        });
        expect(vi.mocked(mockedLocalOptimizationConfig.useLocalConfig))
            .toHaveBeenCalledWith(expectedLocalOptimizationConfigPath);
        expect(vi.mocked(mockedLocalOptimizationConfig.downloadStatsFromPercentJson)).not.toHaveBeenCalled();
    });

    it(`--use-cache with local cache and --include=${FILTER_ID}:`
         + ` loads stats for filter ${FILTER_ID} only`, async () => {
        vi.doMock('fs', () => ({
            default: {
                existsSync: vi.fn().mockImplementation((p: string) => p.endsWith('percent.json')),
                promises: {
                    cp: vi.fn().mockResolvedValue(undefined),
                    rm: vi.fn().mockResolvedValue(undefined),
                    writeFile: vi.fn().mockResolvedValue(undefined),
                },
            },
        }));
        process.argv = ['node', 'build.js', '--use-cache', '--include=1'];
        await import('../build.js');

        const {
            compile: mockedCompile,
            localOptimizationConfig: mockedLocalOptimizationConfig,
        } = await import('@adguard/filters-compiler');
        await vi.waitFor(() => {
            expect(vi.mocked(mockedCompile)).toHaveBeenCalled();
        });
        expect(vi.mocked(mockedLocalOptimizationConfig.useLocalConfig)).toHaveBeenCalledWith(
            expectedLocalOptimizationConfigPath,
        );
        expect(vi.mocked(mockedLocalOptimizationConfig.downloadStatsFromPercentJson)).not.toHaveBeenCalled();
    });
});

const REAL_FILTER_DIR = path.resolve(__dirname, '../../../filters/filter_1_Russian');

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

describe('localOptimizationConfig: rules optimized from local cache', () => {
    let tmpDir: string;
    let optimizationDir: string;
    let allOutput: string;
    let statsContentBefore: string;

    beforeAll(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filters-e2e-genstats-'));

        const filtersDir = path.join(tmpDir, 'filters');
        optimizationDir = path.join(tmpDir, 'optimization_config');
        const platformsDir = path.join(tmpDir, 'platforms');
        const logPath = path.join(tmpDir, 'log.txt');
        const reportPath = path.join(tmpDir, 'report.txt');

        const filterDir = path.join(filtersDir, 'filter_1_Russian');
        await fs.promises.mkdir(filterDir, { recursive: true });

        await fs.promises.copyFile(path.join(REAL_FILTER_DIR, 'metadata.json'), path.join(filterDir, 'metadata.json'));
        await fs.promises.copyFile(path.join(REAL_FILTER_DIR, 'revision.json'), path.join(filterDir, 'revision.json'));

        await fs.promises.writeFile(
            path.join(filterDir, 'template.txt'),
            `! Title: E2E Optimization Test\n${RULE_TO_FILTER}\n${RULE_TO_KEEP}\n`,
            'utf-8',
        );

        const statsDir = path.join(optimizationDir, 'filters', String(FILTER_ID));
        await fs.promises.mkdir(statsDir, { recursive: true });

        await fs.promises.writeFile(
            path.join(optimizationDir, 'percent.json'),
            JSON.stringify({ config: [{ filterId: FILTER_ID }] }),
            'utf-8',
        );

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
        await fs.promises.writeFile(statsPath, statsJson, 'utf-8');
        statsContentBefore = statsJson;

        localOptimizationConfig.useLocalConfig(optimizationDir);

        await compile(filtersDir, logPath, reportPath, platformsDir, [FILTER_ID], [], TEST_PLATFORM_CONFIG);

        const outputFiles: string[] = await findFiles(platformsDir, () => true);
        const optimizedFiles = outputFiles.filter((f) => f.endsWith('_optimized.txt'));
        expect(optimizedFiles.length).toBeGreaterThan(0);
        allOutput = (await Promise.all(optimizedFiles.map((f) => fs.promises.readFile(f, 'utf-8')))).join('\n');
    }, 30_000);

    it('generateStats() does not overwrite existing local stats.json', async () => {
        const statsPath = path.join(tmpDir, 'optimization_config', 'filters', String(FILTER_ID), 'stats.json');
        const statsContentAfter = await fs.promises.readFile(statsPath, 'utf-8');
        expect(statsContentAfter).toBe(statsContentBefore);
    });

    it('rule with 0 hits is absent in compiled output', () => {
        expect(allOutput).not.toContain(RULE_TO_FILTER);
    });

    it('rule with 9999 hits is present in compiled output', () => {
        expect(allOutput).toContain(RULE_TO_KEEP);
    });

    afterAll(async () => {
        await localOptimizationConfig.reset(optimizationDir);
        await fs.promises.rm(tmpDir, { recursive: true, force: true });
    });
});
