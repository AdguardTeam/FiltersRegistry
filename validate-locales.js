/* globals require, __dirname */
const path = require('path');
const compiler = require("adguard-filters-compiler");

const LOCALES_DIR_PATH = './locales';

const localesDirPath = path.join(__dirname, LOCALES_DIR_PATH);
const localesValidationResult = compiler.validateLocales(localesDirPath);
if (localesValidationResult.length !== 0) {
    throw new Error('Invalid locales messages');
}
