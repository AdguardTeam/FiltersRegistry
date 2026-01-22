import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Converts to/from crowdin format
 *
 * @type {{importFile, exportFile}}
 */
const converter = (() => {
    'use strict';

    /**
     * Reads file to string
     * @param filePath
     */
    const readFile = (filePath) => {
        try {
            return fs.readFileSync(filePath, { encoding: 'utf-8' });
        } catch (e) {
            return null;
        }
    };

    /**
     * Writes string to file
     * @param filePath
     * @param data
     */
    const writeFile = (filePath, data) => {
        fs.writeFileSync(filePath, data, 'utf8');
    };

    /**
     * Parses object info
     * @param string
     * @param mask
     * @returns {{id: *, message: *}}
     */
    const parseInfo = (string, mask) => {
        const searchIndex = string.indexOf(mask) + mask.length;

        return {
            id: string.substring(searchIndex, string.indexOf('.', searchIndex)),
            message: string.substring(string.lastIndexOf('.') + 1),
        };
    };

    /**
     * Converts file from crowdin format
     *
     * @param locale Locale code.
     * @param file File path.
     * @param outFile Output file path.
     * @param mask Mask to identify the object — 'filter' or 'group' or 'tag'.
     */
    const importFile = (locale, file, outFile, mask) => {
        // eslint-disable-next-line no-console
        console.log(`Importing file for locale: ${locale}`);

        const source = readFile(file);
        if (!source) {
            // eslint-disable-next-line no-console
            console.warn('File is empty');
            return;
        }

        const json = JSON.parse(source);

        const map = new Map();
        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const p in json) {
            const info = parseInfo(p, mask);
            let item = map.get(info.id);
            if (!item) {
                item = {};
            }

            item[info.message] = json[p].message;

            map.set(info.id, item);
        }

        const result = [];
        map.forEach((value, key) => {
            const o = {};
            // eslint-disable-next-line no-restricted-syntax, guard-for-in
            for (const p in value) {
                o[`${mask}${key}.${p}`] = value[p].replace(/\n/g, '');
            }
            result.push(o);
        });

        writeFile(outFile, JSON.stringify(result, null, '\t'));

        // eslint-disable-next-line no-console
        console.log(`Importing file for locale: ${locale} ok!`);
    };

    /**
     * Converts file to crowdin format
     *
     * @param locale
     * @param file
     * @param outFile
     */
    const exportFile = (locale, file, outFile) => {
        // eslint-disable-next-line no-console
        console.log(`Exporting for locale: ${locale}`);

        const source = readFile(file);
        const json = JSON.parse(source);

        const result = {};
        json.forEach((o) => {
            // eslint-disable-next-line no-restricted-syntax, guard-for-in
            for (const p in o) {
                result[p] = {
                    message: o[p],
                };
            }
        });

        writeFile(outFile, JSON.stringify(result, null, '\t'));
    };

    return {
        importFile,
        exportFile,
    };
})();

const args = process.argv;
const action = args[2];
const file = args[3];
const locale = args[4];
const out = args[5];
const mask = args[6];

if (action === 'import') {
    converter.importFile(locale, path.join(__dirname, file), path.join(__dirname, out), mask);
} else if (action === 'export') {
    converter.exportFile(locale, path.join(__dirname, file), path.join(__dirname, out));
}
