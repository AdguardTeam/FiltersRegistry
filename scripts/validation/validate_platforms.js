const path = require('path');
const fs = require('fs');
const compiler = require('adguard-filters-compiler');
const { PATCH_EXTENSION } = require('@adguard/diff-builder');

const { FOLDER_WITH_NEW_FILTERS } = require('../build/constants');

const FILTERS_REQUIRED_AMOUNT = 80;

const args = process.argv.slice(2);

let platforms = args[0];
if (!platforms) {
    platforms = '../../platforms';
}

const platformsPath = path.join(__dirname, platforms);

const validationResult = compiler.validateJSONSchema(platformsPath, FILTERS_REQUIRED_AMOUNT);
if (!validationResult) {
    throw new Error('Invalid filters json');
}

/**
 * Asynchronously validates that directory with patches contains only one empty
 * patch file (for future versions).
 *
 * @param dir The directory to validate.
 *
 * @throws {Error} Throws an error if a folder contains more than one empty patch file.
 *
 * @returns A promise that resolves when the validation is complete.
 */
const validatePatchesFolder = async (dir) => {
    // eslint-disable-next-line no-console
    console.log(`Validating ${dir}`);

    const files = await fs.promises.readdir(dir);
    let folderContainsPatches = false;
    let emptyPatchesCounter = 0;

    for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        if (file.endsWith(PATCH_EXTENSION)) {
            folderContainsPatches = true;
        }

        const filePath = path.join(dir, file);
        // eslint-disable-next-line no-await-in-loop
        const stat = await fs.promises.stat(filePath);

        if (stat.isDirectory()) {
            // eslint-disable-next-line no-await-in-loop
            await validatePatchesFolder(filePath);
            continue;
        }

        const { size } = stat;
        if (size === 0) {
            emptyPatchesCounter += 1;
        }
    }

    if (folderContainsPatches && emptyPatchesCounter > 1) {
        throw new Error(`Folder ${dir} contains more than one empty patches.`);
    }
};

const validatePatches = async () => {
    await validatePatchesFolder(FOLDER_WITH_NEW_FILTERS);
};

validatePatches();
