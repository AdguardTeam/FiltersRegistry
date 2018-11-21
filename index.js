/* globals require, __dirname, process */

const whitelist = [];
const blacklist = [];

let args = process.argv.slice(2);
args.forEach(function (val) {
    if (val.startsWith('-i=')) {
        whitelist.push(val.substr(3).split(','));
    }

    if (val.startsWith('-s=')) {
        blacklist.push(val.substr(3).split(','));
    }
});

const path = require('path');
const compiler = require("adguard-filters-compiler");

const filtersDir = path.join(__dirname, './filters');
const logPath = path.join(__dirname, './log.txt');
const domainBlacklistFile = path.join(__dirname, './domains-blacklist.txt');

const platformsPath = path.join(__dirname, './platforms');

compiler.compile(filtersDir, logPath, domainBlacklistFile, platformsPath, whitelist, blacklist);