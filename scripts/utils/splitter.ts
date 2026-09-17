/**
 * Splits a string by lines while preserving line breaks within the original lines.
 *
 * @param s The input string to split.
 * @returns An array of strings where each element is a complete line of text,
 * including its line break.
 */
export function splitByLines(s: string): string[] {
    // Preserve end-of-line characters in the split strings.
    return s.split(/(?<=\r?\n)/);
}
