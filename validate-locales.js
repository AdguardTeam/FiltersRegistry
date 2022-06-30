/* globals require, __dirname */
const path = require('path');
const compiler = require("adguard-filters-compiler");

const LOCALES_DIR_PATH = './locales';

const REQUIRED_LOCALES = [
    // kepp base locale here as well
    'en',
    // + other our locales
    'ru',
    'es',
    'de',
    'fr',
    'it',
    'ko',
    'zh_CN',
    'zh_TW',
];

const localesDirPath = path.join(__dirname, LOCALES_DIR_PATH);
const localesValidation = compiler.validateLocales(localesDirPath, REQUIRED_LOCALES);

if (!localesValidation.ok) {
    throw new Error('Invalid locales messages');
}
