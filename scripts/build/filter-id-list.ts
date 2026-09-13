/**
 * Parses filter IDs separated by commas or spaces.
 *
 * @param value Raw value after the flag's equals sign.
 * @returns Parsed filter IDs.
 */
export function parseFilterIDs(value: string): number[] {
    return value
        .split(',')
        .join(' ')
        .split(' ')
        .map((x) => Number.parseInt(x, 10))
        .filter((x) => !Number.isNaN(x));
}
