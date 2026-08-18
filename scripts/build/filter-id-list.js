/**
 * Parse a filter ID list from a CLI flag.
 *
 * PowerShell can replace unquoted commas when invoking a .cmd shim, so accept
 * both comma- and whitespace-separated values. Reject malformed tokens instead
 * of silently dropping them or partially parsing them with parseInt().
 *
 * @param {string} value - Raw value after the flag's equals sign.
 * @param {string} flagName - Flag name used in validation errors.
 * @returns {number[]} Parsed filter IDs.
 */
export function parseFilterIDs(value, flagName) {
    const tokens = value.split(/[,\\s]+/).filter(Boolean);
    const invalid = tokens.find((token) => !/^\\d+$/.test(token));

    if (invalid !== undefined) {
        throw new Error(`Invalid filter ID in ${flagName}: "${invalid}"`);
    }

    return tokens.map((token) => Number(token));
}
