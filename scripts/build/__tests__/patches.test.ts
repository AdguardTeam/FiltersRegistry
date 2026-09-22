import {
    describe,
    it,
    expect,
} from 'vitest';
import { shouldGeneratePatch } from '../patches.js';

const EMPTY_FILTER_IDS: number[] = [];

/**
 * Path examples mirror the layout produced by the compiler:
 * `<platform>/<sub-target>/filters/<filterId>.txt` with either
 * "/" (unix-like) or "\\" (windows) path separators.
 */
describe('shouldGeneratePatch', () => {
    it('skips patch generation for Edge MV3 on unix-style paths', () => {
        const file = 'platforms/extension/edge-mv3/filters/1.txt';

        expect(shouldGeneratePatch(file, EMPTY_FILTER_IDS, EMPTY_FILTER_IDS)).toBe(false);
    });

    it('skips patch generation for Edge MV3 on windows-style paths', () => {
        const file = 'platforms\\extension\\edge-mv3\\filters\\1.txt';

        expect(shouldGeneratePatch(file, EMPTY_FILTER_IDS, EMPTY_FILTER_IDS)).toBe(false);
    });

    it('reaches patch generation for Edge MV2 on unix-style paths', () => {
        const file = 'platforms/extension/edge/filters/1.txt';

        expect(shouldGeneratePatch(file, EMPTY_FILTER_IDS, EMPTY_FILTER_IDS)).toBe(true);
    });

    it('reaches patch generation for Edge MV2 on windows-style paths', () => {
        const file = 'platforms\\extension\\edge\\filters\\1.txt';

        expect(shouldGeneratePatch(file, EMPTY_FILTER_IDS, EMPTY_FILTER_IDS)).toBe(true);
    });

    it('preserves the existing MV3 exclusions for chromium-mv3 and opera-mv3', () => {
        const unixPath = 'platforms/extension/chromium-mv3/filters/1.txt';
        const windowsPath = 'platforms\\extension\\opera-mv3\\filters\\1.txt';

        expect(shouldGeneratePatch(unixPath, EMPTY_FILTER_IDS, EMPTY_FILTER_IDS)).toBe(false);
        expect(shouldGeneratePatch(windowsPath, EMPTY_FILTER_IDS, EMPTY_FILTER_IDS)).toBe(false);
    });

    it('skips patch generation for android-content-blocker', () => {
        const file = 'platforms/extension/android-content-blocker/filters/1.txt';

        expect(shouldGeneratePatch(file, EMPTY_FILTER_IDS, EMPTY_FILTER_IDS)).toBe(false);
    });

    it('skips patch generation for the old mac platform', () => {
        const file = 'platforms/mac/filters/1.txt';

        expect(shouldGeneratePatch(file, EMPTY_FILTER_IDS, EMPTY_FILTER_IDS)).toBe(false);
    });

    it('reaches patch generation for mac_v2', () => {
        const file = 'platforms/mac_v2/filters/1.txt';

        expect(shouldGeneratePatch(file, EMPTY_FILTER_IDS, EMPTY_FILTER_IDS)).toBe(true);
    });

    it('skips files that are not in the "{filterId}.txt" format', () => {
        const file = 'platforms/extension/edge/filters/header.txt';

        expect(shouldGeneratePatch(file, EMPTY_FILTER_IDS, EMPTY_FILTER_IDS)).toBe(false);
    });

    it('respects --include and --skip filter ID scoping', () => {
        const file = 'platforms/extension/edge/filters/1.txt';

        expect(shouldGeneratePatch(file, [1], EMPTY_FILTER_IDS)).toBe(true);
        expect(shouldGeneratePatch(file, [2], EMPTY_FILTER_IDS)).toBe(false);
        expect(shouldGeneratePatch(file, EMPTY_FILTER_IDS, [1])).toBe(false);
    });
});
