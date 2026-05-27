/**
 * Build configuration parser and validator.
 */

export interface BuildFlags {
    includedFilterIDs: number[];
    excludedFilterIDs: number[];
    rawReportPath: string;
    useCache: boolean;
    generateCache: boolean;
    noPatchesPrepare: boolean;
    stripGeneratedMeta: boolean;
}

/**
 * Parses command-line arguments into a structured BuildFlags object.
 *
 * @param argv - Array of command-line arguments (typically process.argv.slice(2)).
 * @returns Parsed flags with resolved paths and ID lists.
 */
export function parseFlags(argv: string[]): BuildFlags {
    const flags: BuildFlags = {
        includedFilterIDs: [],
        excludedFilterIDs: [],
        rawReportPath: '',
        useCache: false,
        generateCache: false,
        noPatchesPrepare: false,
        stripGeneratedMeta: false,
    };

    argv.forEach((val) => {
        if (val.startsWith('-i=') || val.startsWith('--include=')) {
            const value = val.slice(val.indexOf('=') + 1);
            flags.includedFilterIDs = value
                .split(',')
                .map((x) => Number.parseInt(x, 10))
                .filter((x) => !Number.isNaN(x));
        }

        if (val.startsWith('-s=') || val.startsWith('--skip=')) {
            const value = val.slice(val.indexOf('=') + 1);
            flags.excludedFilterIDs = value
                .split(',')
                .map((x) => Number.parseInt(x, 10))
                .filter((x) => !Number.isNaN(x));
        }

        if (val.startsWith('--report=')) {
            flags.rawReportPath = val.slice(val.indexOf('=') + 1).trim();
        }

        if (val === '--use-cache') {
            flags.useCache = true;
        }

        if (val === '--generate-cache') {
            flags.generateCache = true;
        }

        if (val === '--no-patches-prepare') {
            flags.noPatchesPrepare = true;
        }

        if (val === '--strip-generated-meta') {
            flags.stripGeneratedMeta = true;
        }
    });

    return flags;
}

/**
 * Validates consistency of build flags.
 * Returns a result object if there is an issue (error or warning), or `null` if valid.
 *
 * @param flags - The parsed build flags object.
 * @returns Validation result with type and message.
 */
export function validateFlags(flags: BuildFlags): { type: 'error' | 'warning'; message: string } | null {
    const hint = 'See Command Compatibility in DEVELOPMENT.md for valid combinations.';

    if (flags.useCache && flags.generateCache) {
        return {
            type: 'error',
            message: `Error: --use-cache and --generate-cache are mutually exclusive.\n${hint}`,
        };
    }

    if (flags.generateCache && (flags.stripGeneratedMeta || flags.noPatchesPrepare)) {
        const ignored: string[] = [];
        if (flags.stripGeneratedMeta) ignored.push('--strip-generated-meta');
        if (flags.noPatchesPrepare) ignored.push('--no-patches-prepare');

        const flagsStr = ignored.join(' and ');
        const verb = ignored.length > 1 ? 'are' : 'is';
        const msg = `Error: ${flagsStr} ${verb} incompatible with `
            + '--generate-cache, which exits early without generating '
            + 'platform files.';

        return {
            type: 'error',
            message: `${msg}\n${hint}`,
        };
    }

    return null;
}

const KNOWN_ARGS_PREFIXES = [
    '--include=', '-i=',
    '--skip=', '-s=',
    '--report=',
] as const;

const KNOWN_ARGS_EXACT = new Set([
    '--use-cache',
    '--generate-cache',
    '--no-patches-prepare',
    '--strip-generated-meta',
]);

/**
 * Validates that all provided command-line arguments are known.
 * If an argument is unknown, returns an error string immediately.
 */
export function validateArgs(argv: string[]): string | null {
    const hint = 'See Command Compatibility in DEVELOPMENT.md for valid combinations.';
    const unknown = argv.find((arg) => {
        if (KNOWN_ARGS_EXACT.has(arg)) {
            return false;
        }
        return !KNOWN_ARGS_PREFIXES.some((prefix) => arg.startsWith(prefix));
    });
    if (unknown) {
        return `\nUnknown argument: ${unknown}\n${hint}`;
    }
    return null;
}
