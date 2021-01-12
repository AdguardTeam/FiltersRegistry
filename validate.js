/* globals require, __dirname, process */
const path = require('path');
const compiler = require("adguard-filters-compiler");

const FILTERS_REQUIRED_AMOUNT = 80;

let args = process.argv.slice(2);

let platforms = args[0];
if (!platforms) {
    platforms = './platforms';
}

const platformsPath = path.join(__dirname, platforms);

const validationResult = compiler.validateJSONSchema(platformsPath, FILTERS_REQUIRED_AMOUNT);
if (!validationResult) {
    throw new Error('Invalid filters json');
}
