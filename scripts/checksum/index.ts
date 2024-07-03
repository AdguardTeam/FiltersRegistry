import MD5 from 'crypto-js/md5';
import Base64 from 'crypto-js/enc-base64';

import { splitByLines } from '../utils/splitter';

const CHECKSUM_TAG = 'Checksum';

/**
 * Normalizes a message string by removing carriage return characters ('\r')
 * and replacing multiple newline characters ('\n') with a single newline character.
 * This function standardizes the format of newline characters in the message.
 *
 * @param content The string to normalize.
 * @returns The normalized message with '\r' removed and consecutive '\n' characters
 * replaced with a single '\n'.
 */
function normalizeContent(content: string): string {
    return content
        .replace(/\r/g, '')
        .replace(/\n+/g, '\n');
}

/**
 * Calculates the checksum of the given content using the MD5 hashing algorithm
 * and encodes it in Base64. It normalizes the content by removing carriage
 * returns and replacing multiple newlines with a single newline.
 * The checksum is then formatted with a trailing special comment identifier.
 * Trailing '=' characters in the Base64 encoded string are removed to match
 * the expected format.
 *
 * @see {@link https://adblockplus.org/en/filters#special-comments Adblock Plus special comments}
 * @see {@link https://hg.adblockplus.org/adblockplus/file/tip/addChecksum.py Adblock Plus checksum script}
 *
 * @param content The content to hash.
 * @returns The formatted checksum string.
 */
function calculateChecksumMD5(content: string): string {
    content = normalizeContent(content);
    const checksum = Base64.stringify(MD5(content));

    return checksum.trim().replace(/=+$/g, '');
}

/**
 * Checks if the provided file content contains a checksum tag within its first 200 characters.
 * This approach is used to exclude parsing checksums from included filters.
 *
 * @param file The file content as a string.
 * @returns `true` if the checksum tag is found, otherwise `false`.
 */
function hasChecksum(file: string): boolean {
    const partOfFile = file.substring(0, 200);
    const lines = splitByLines(partOfFile);

    return lines.some((line) => line.startsWith(`! ${CHECKSUM_TAG}`));
}

/**
 * Creates a tag for filter list metadata.
 *
 * @param tagName The name of the tag.
 * @param value The value of the tag.
 * @param lineEnding The line ending to use in the created tag.
 * @returns The created tag in the `! ${tagName}: ${value}` format.
 */
function createTag(tagName: string, value: string, lineEnding: string): string {
    return `! ${tagName}: ${value}${lineEnding}`;
}

/**
 * Removes a specified tag from an array of filter content strings.
 * This function searches for the first occurrence of the specified tag within
 * the first N lines and removes the entire line containing that tag. If the tag is not
 * found, the array remains unchanged.
 *
 * @param tagName The name of the tag to be removed from the filter content.
 * @param filterContent An array of strings, each representing a line of filter content.
 * @returns A new array of filter content with the specified tag removed.
 * If the tag is not found, the original array is returned unmodified.
 */
function removeTag(
    tagName: string,
    filterContent: string[],
): string[] {
    // Lines of filter metadata to parse
    const AMOUNT_OF_LINES_TO_PARSE = 50;

    // Make a copy of the array to avoid mutation.
    const copy = filterContent.slice();

    // Parse only the first 50 lines. Parsing the entire file is unnecessary.
    const updatedFile = filterContent.slice(
        0,
        Math.min(AMOUNT_OF_LINES_TO_PARSE, filterContent.length),
    );

    const tagIdx = updatedFile.findIndex((line) => line.includes(tagName));

    if (tagIdx >= 0) {
        copy.splice(tagIdx, 1);
    }

    return copy;
}

/**
 * Updates the checksum of the filter file.
 *
 * @param filterContent The content of the filter file.
 * @returns The content of the filter file with the updated checksum.
 */
export function updateContentChecksum(filterContent: string): string {
    let fileLines = splitByLines(filterContent);
    fileLines = removeTag(CHECKSUM_TAG, fileLines);

    const lineEnding = fileLines[0].endsWith('\r\n') ? '\r\n' : '\n';

    // If the filter had a checksum, calculate and insert a new checksum tag at the beginning of the filter
    if (hasChecksum(filterContent)) {
        const updatedChecksum = calculateChecksumMD5(fileLines.join(''));
        const checksumTag = createTag(CHECKSUM_TAG, updatedChecksum, lineEnding);

        fileLines.unshift(checksumTag);
    }

    return fileLines.join('');
}
