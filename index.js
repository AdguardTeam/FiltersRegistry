/* globals require, __dirname */

const path = require('path');
const compiler = require("adguard-filters-compiler");

const filtersDir = path.join(__dirname, './filters');
const logPath = path.join(__dirname, './log.txt');
const domainBlacklistFile = path.join(__dirname, './domains-blacklist.txt');

const platformsPath = path.join(__dirname, './platforms');

compiler.compile(filtersDir, logPath, domainBlacklistFile, platformsPath);