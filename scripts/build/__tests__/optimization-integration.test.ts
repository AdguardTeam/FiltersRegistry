import {
    describe, it, vi, expect, beforeEach, afterEach,
} from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';

const expectedOptimizationConfigCachePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../temp/optimization_config',
);

vi.mock('@adguard/filters-compiler', () => ({
    compile: vi.fn().mockResolvedValue(undefined),
    localOptimizationConfig: {
        downloadPercentJson: vi.fn().mockResolvedValue(undefined),
        downloadStatsFromPercentJson: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn().mockReturnValue(false),
        promises: {
            cp: vi.fn().mockResolvedValue(undefined),
            rm: vi.fn().mockResolvedValue(undefined),
            writeFile: vi.fn().mockResolvedValue(undefined),
        },
    },
}));

vi.mock('../../utils/find_files.js', () => ({
    findFiles: vi.fn().mockResolvedValue([]),
}));

describe('build.js optimization config integration', () => {
    const originalArgv = process.argv;

    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        process.argv = originalArgv;
        vi.clearAllMocks();
    });

    it('downloadStatsFromPercentJson is called with optimizationConfigCacheDir when --use-cache', async () => {
        process.argv = ['node', 'build.js', '--use-cache'];
        await import('../build.js');

        const { localOptimizationConfig } = await import('@adguard/filters-compiler');
        await vi.waitFor(() => {
            expect(vi.mocked(localOptimizationConfig.downloadStatsFromPercentJson))
                .toHaveBeenCalledWith(expectedOptimizationConfigCachePath);
        });
    });

    it('downloadPercentJson is called with optimizationConfigCacheDir when --generate-cache', async () => {
        process.argv = ['node', 'build.js', '--generate-cache'];
        await import('../build.js');

        const { localOptimizationConfig } = await import('@adguard/filters-compiler');
        await vi.waitFor(() => {
            expect(vi.mocked(localOptimizationConfig.downloadPercentJson))
                .toHaveBeenCalledWith(expectedOptimizationConfigCachePath);
        });
    });
});
