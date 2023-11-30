/**
 * Converts to/from crowdin format
 *
 * @type {{importFile, exportFile}}
 */
const converter = (() => {
    'use strict';

    // eslint-disable-next-line global-require
    const fs = require('fs');

    /**
     * Reads file to string
     * @param path
     */
    const readFile = (path) => {
        try {
            return fs.readFileSync(path, { encoding: 'utf-8' });
        } catch (e) {
            return null;
        }
    };

    /**
     * Writes string to file
     * @param path
     * @param data
     */
    const writeFile = (path, data) => {
        fs.writeFileSync(path, data, 'utf8');
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
     * @param locale
     * @param file
     * @param outFile
     * @param mask
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

const path = require('path');

if (action === 'import') {
    converter.importFile(locale, path.join(__dirname, file), path.join(__dirname, out), mask);
} else if (action === 'export') {
    converter.exportFile(locale, path.join(__dirname, file), path.join(__dirname, out));
}
