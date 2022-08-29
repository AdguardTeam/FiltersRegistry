/* globals require, __dirname, process */

let whitelist = [];
let blacklist = [];

let args = process.argv.slice(2);
args.forEach(function (val) {
    if (val.startsWith('-i=')) {
        whitelist = whitelist.concat(val.substr(3).split(',').map(x => Number.parseInt(x)));
    }

    if (val.startsWith('-s=')) {
        blacklist = blacklist.concat(val.substr(3).split(',').map(x => Number.parseInt(x)));
    }
});

const fs = require('fs');
const path = require('path');
const compiler = require("adguard-filters-compiler");

const filtersDir = path.join(__dirname, './filters');
const logPath = path.join(__dirname, './log.txt');

let reportPath = path.join(__dirname, './report.txt');
if (whitelist.length > 0 || blacklist.length > 0) {
    // Disable report if this is not a full build
    reportPath = null;
}

const customPlatformsConfig = require('./custom_platforms.js');
const platformsPath = path.join(__dirname, './platforms');

/**
 * 
 * Replaces all occurrencies of necessary strings to new ones in the build results.
 */

 async function replaceInFilters() {
/**
 * 
 * Search for specific files by extension type recursively.
 * Some directories and files are currently excluded due to the task.
 * 
 * @param {string} dir - specific directory that limits the search.
 * @param {string} type - type of the file.
 */
    function searchFiles(dir, type) {
        let values = [];
        let subDirs = fs.readdirSync(dir);
        subDirs.forEach((subDir) => {
            subDir = path.resolve(dir, subDir);
            let statElement = fs.statSync(subDir);
            if (statElement.isDirectory() && path.basename(subDir) !== 'android-content-blocker') {
                values = values.concat(searchFiles(subDir, type));
            }
            if (statElement.isFile()
                && !subDir.includes('local_script_rules')
                && path.extname(subDir) === type) {
                values.push(subDir);
            }
          });
        return values;
      };
      let filesTxt = searchFiles(platformsPath, '.txt');
      filesTxt.forEach((fileTxt) => {
        let data = fs.readFileSync(fileTxt, 'utf8');
        let formattedData = data.replace(/:has\(/g, ':-abp-has(');
        fs.writeFileSync(fileTxt, formattedData, 'utf8');
      });
}

/**
 * Compiler entry point.
 */
async function main() {
    await compiler.compile(
        filtersDir,
        logPath,
        reportPath,
        platformsPath,
        whitelist,
        blacklist,
        customPlatformsConfig,
    );
    // TODO: remove this when ExtCSS v2.0 is released to all AG products.
    await replaceInFilters();
}

main();
