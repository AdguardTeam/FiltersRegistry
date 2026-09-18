/* eslint-disable no-console */
import { Command } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import { updateWildcardDomains } from './wildcard-domains-updater.js';
import { expandWildcardDomains } from './wildcard-expander.js';

const program = new Command();

program
    .command('update-wildcard-domains <filtersDir> <wildcardDomainsFile>')
    .description('Run wildcard domain processor')
    .action(async (filtersDir, wildcardDomainsFile) => {
        const filtersDirPath = path.resolve(process.cwd(), filtersDir);
        const wildcardDomainsFilePath = path.resolve(process.cwd(), wildcardDomainsFile);
        try {
            await updateWildcardDomains(filtersDirPath, wildcardDomainsFilePath);
        } catch (e) {
            console.error(e);
        }
    });

program
    .command('expand-wildcard-domains <platformsDir> <wildcardDomainsFile>')
    .description('Run patch platforms to expand wildcards')
    .action(async (platformsDir, wildcardDomainsFile) => {
        const platformsDirPath = path.resolve(process.cwd(), platformsDir);
        const wildcardDomainsFilePath = path.resolve(process.cwd(), wildcardDomainsFile);
        try {
            await expandWildcardDomains(platformsDirPath, wildcardDomainsFilePath);
        } catch (e) {
            console.error(e);
        }
    });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Only run the command-line interface if the script is executed directly.
// The entry point is this file when it is passed explicitly, and its directory
// when the module is invoked by directory name, which is how the
// `update-wildcard-domains` and `expand-wildcard-domains` package scripts run it.
const entryPoint = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (entryPoint === __filename || entryPoint === __dirname) {
    program.parse(process.argv);
}

export {
    updateWildcardDomains,
    expandWildcardDomains,
};
