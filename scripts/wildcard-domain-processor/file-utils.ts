/* eslint-disable no-await-in-loop,no-restricted-syntax */
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Checks if a file path matches the given ending pattern.
 * @param filePath The file path to check.
 * @param ending The string or regex pattern to match against.
 * @returns True if the file path matches the pattern, false otherwise.
 */
function matchEnding(filePath: string, ending: string | RegExp): boolean {
    if (typeof ending === 'string') {
        return filePath.endsWith(ending);
    }
    return ending.test(filePath);
}

/**
 * Recursively searches a directory for files that match the given ending pattern and returns their full paths.
 * @param dir The directory to start the search from.
 * @param ending The string or regex pattern that the file paths should match.
 * @returns A promise that resolves to an array of full paths of the found files.
 * @throws Will throw an error if the directory cannot be read.
 */
export async function findFilterFiles(dir: string, ending: string | RegExp): Promise<string[]> {
    let results: string[] = [];

    try {
        const files = await fs.readdir(dir, { withFileTypes: true });

        for (const file of files) {
            const fullPath = path.join(dir, file.name);

            if (file.isDirectory()) {
                // If the item is a directory, recursively search it
                const subDirFiles = await findFilterFiles(fullPath, ending);
                results = results.concat(subDirFiles);
            } else if (file.isFile() && matchEnding(fullPath, ending)) {
                // If the item is a file and matches the ending pattern, add its full path to the results
                results.push(fullPath);
            }
        }
    } catch (e) {
        // eslint-disable-next-line no-console
        console.log(`Error processing directory ${dir}: ${e}`);
        throw e;
    }

    return results;
}

/**
 * Reads the content of a file at a given path.
 * @param filePath - The path to the file to be read.
 * @returns A promise that resolves to the content of the file as a string.
 * @throws Will throw an error if the file cannot be read.
 */
export async function readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf8');
}

/**
 * Writes content to a file at a given path. If the file does not exist, it will be created.
 * @param filePath - The path to the file where the content will be written.
 * @param content - The content to write to the file.
 * @returns A promise that resolves when the file has been written.
 * @throws Will throw an error if the file cannot be written.
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(path.resolve(__dirname, filePath), content, 'utf8');
}
