import {
    describe, it, expect,
} from 'vitest';
// eslint-disable-next-line import/no-unresolved
import { parseFlags, validateFlags, validateArgs } from '../build-config.js';

describe('parseFlags', () => {
    it('parses --include and --skip', () => {
        const flags = parseFlags(['--include=1,2,3', '--skip=12,24']);
        expect(flags.includedFilterIDs).toEqual([1, 2, 3]);
        expect(flags.excludedFilterIDs).toEqual([12, 24]);
    });

    it('parses short forms -i and -s', () => {
        const flags = parseFlags(['-i=1,2', '-s=3']);
        expect(flags.includedFilterIDs).toEqual([1, 2]);
        expect(flags.excludedFilterIDs).toEqual([3]);
    });

    it('parses --report', () => {
        const flags = parseFlags(['--report=report.txt']);
        expect(flags.rawReportPath).toBe('report.txt');
    });

    it('parses all boolean flags', () => {
        const flags = parseFlags([
            '--use-cache',
            '--generate-cache',
            '--no-patches-prepare',
            '--strip-generated-meta',
        ]);

        expect(flags.useCache).toBe(true);
        expect(flags.generateCache).toBe(true);
        expect(flags.noPatchesPrepare).toBe(true);
        expect(flags.stripGeneratedMeta).toBe(true);
    });

    it('ignores unknown arguments', () => {
        const flags = parseFlags(['--mode=unknown', '--foo']);
        expect(flags.useCache).toBe(false);
    });

    it('filters out NaN from invalid IDs', () => {
        const flags = parseFlags(['--include=1,abc,3']);
        expect(flags.includedFilterIDs).toEqual([1, 3]);
    });
});

describe('validateFlags', () => {
    it('allows valid single flags', () => {
        const flags = parseFlags(['--use-cache']);
        expect(validateFlags(flags)).toBeNull();
    });

    it('allows --generate-cache with --include', () => {
        const flags = parseFlags(['--generate-cache', '--include=1,2,3']);
        expect(validateFlags(flags)).toBeNull();
    });

    it('rejects --use-cache combined with --generate-cache', () => {
        const flags = parseFlags(['--use-cache', '--generate-cache']);
        const result = validateFlags(flags);
        expect(result?.type).toBe('error');
        expect(result?.message).toContain('mutually exclusive');
        expect(result?.message).toContain('DEVELOPMENT.md');
    });

    it('errors on --generate-cache combined with --strip-generated-meta', () => {
        const flags = parseFlags(['--generate-cache', '--strip-generated-meta']);
        const result = validateFlags(flags);
        expect(result?.type).toBe('error');
        expect(result?.message).toContain('--strip-generated-meta');
        expect(result?.message).toContain('incompatible');
        expect(result?.message).toContain('DEVELOPMENT.md');
    });

    it('errors on --generate-cache combined with --no-patches-prepare', () => {
        const flags = parseFlags(['--generate-cache', '--no-patches-prepare']);
        const result = validateFlags(flags);
        expect(result?.type).toBe('error');
        expect(result?.message).toContain('--no-patches-prepare');
        expect(result?.message).toContain('DEVELOPMENT.md');
    });

    it('errors on multiple incompatible flags with --generate-cache', () => {
        const flags = parseFlags([
            '--generate-cache',
            '--strip-generated-meta',
            '--no-patches-prepare',
        ]);
        const result = validateFlags(flags);
        expect(result?.type).toBe('error');
        expect(result?.message).toContain('--strip-generated-meta and --no-patches-prepare');
        expect(result?.message).toContain('are incompatible');
        expect(result?.message).toContain('DEVELOPMENT.md');
    });

    it('allows multiple valid combinations', () => {
        const flags = parseFlags([
            '--include=1,2',
            '--no-patches-prepare',
            '--strip-generated-meta',
        ]);
        expect(validateFlags(flags)).toBeNull();
    });
});

describe('validateArgs', () => {
    it('allows all valid arguments', () => {
        expect(validateArgs(['--include=1,2'])).toBeNull();
        expect(validateArgs(['-i=1'])).toBeNull();
        expect(validateArgs(['--skip=12'])).toBeNull();
        expect(validateArgs(['-s=12'])).toBeNull();
        expect(validateArgs(['--report=file.txt'])).toBeNull();
        expect(validateArgs(['--use-cache'])).toBeNull();
        expect(validateArgs(['--generate-cache'])).toBeNull();
        expect(validateArgs(['--no-patches-prepare'])).toBeNull();
        expect(validateArgs(['--strip-generated-meta'])).toBeNull();
    });

    it('rejects random single-word arguments', () => {
        expect(validateArgs(['unknown'])).toContain('Unknown argument: unknown');
        expect(validateArgs(['build'])).toContain('Unknown argument: build');
        expect(validateArgs(['123'])).toContain('Unknown argument: 123');
    });

    it('includes DEVELOPMENT.md hint in unknown argument error', () => {
        const result = validateArgs(['saasdasd']);
        expect(result).toContain('DEVELOPMENT.md');
    });

    it('rejects arbitrary flags', () => {
        expect(validateArgs(['--foo'])).toContain('Unknown argument: --foo');
        expect(validateArgs(['--arg'])).toContain('Unknown argument: --arg');
        expect(validateArgs(['--unknown'])).toContain('Unknown argument: --unknown');
        expect(validateArgs(['-a'])).toContain('Unknown argument: -a');
        expect(validateArgs(['-x'])).toContain('Unknown argument: -x');
        expect(validateArgs(['-1'])).toContain('Unknown argument: -1');
        expect(validateArgs(['-Z'])).toContain('Unknown argument: -Z');
    });

    it('rejects common typos of valid flags', () => {
        // Extra letter at end
        expect(validateArgs(['--use-cachee'])).toContain('Unknown argument: --use-cachee');
        expect(validateArgs(['--generate-cach'])).toContain('Unknown argument: --generate-cach');
        expect(validateArgs(['--strip-generate-meta'])).toContain('Unknown argument: --strip-generate-meta');
        // Swapped / missing letter
        expect(validateArgs(['--usecache'])).toContain('Unknown argument: --usecache');
    });

    it('rejects near-miss prefixes for value flags', () => {
        expect(validateArgs(['--includes=1'])).toContain('Unknown argument: --includes=1');
        expect(validateArgs(['--skips=12'])).toContain('Unknown argument: --skips=12');
    });

    it('rejects --report without =value (bare flag)', () => {
        expect(validateArgs(['--report'])).toContain('Unknown argument: --report');
    });

    it('rejects unknown arguments regardless of position among valid args', () => {
        expect(validateArgs(['--include=1', 'junk'])).toContain('Unknown argument: junk');
        expect(validateArgs(['junk', '--include=1'])).toContain('Unknown argument: junk');
        expect(validateArgs(['--use-cache', '-a', '--skip=2'])).toContain('Unknown argument: -a');
        expect(validateArgs(['--genarate-cache']))
            .toContain('Unknown argument: --genarate-cache');
    });

    it('handles empty array (no args)', () => {
        expect(validateArgs([])).toBeNull();
    });
});
