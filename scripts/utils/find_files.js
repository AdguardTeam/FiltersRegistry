/* eslint-disable no-await-in-loop */
import fs from 'fs';
import path from 'path';

/**
 * Recursively finds files in a directory that match the provided filter.
 *
 * @param dir The directory to search in.
 * @param filter A filter function to determine if a file should be included.
 *
 * @returns An array of file paths that match the filter.
 */
export const findFiles = async (dir, filter) => {
    const files = await fs.promises.readdir(dir);
    let fileList = [];

    for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const filePath = path.join(dir, file);
        const stat = await fs.promises.stat(filePath);

        if (stat.isDirectory()) {
            const foundFiles = await findFiles(filePath, filter);
            fileList = fileList.concat(foundFiles);
        } else if (filter(filePath)) {
            fileList = fileList.concat([filePath]);
        }
    }

    return fileList;
};
