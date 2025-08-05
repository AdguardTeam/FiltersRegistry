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

// Only run the command-line interface if the script is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    program.parse(process.argv);
}

export {
    updateWildcardDomains,
    expandWildcardDomains,
};
