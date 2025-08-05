/* eslint-disable no-await-in-loop,no-restricted-syntax,no-console */
import * as path from 'path';
// There is no type definition available for the following import.
// @ts-ignore
import { findDeadDomains } from '@adguard/dead-domains-linter/src/urlfilter';
import { getDomains } from './domain-extractor.js';
import { utils } from './utils.js';
import { TOP_LEVEL_DOMAIN_LIST } from './top-tld.js';
import { findFilterFiles, readFile, writeFile } from './file-utils.js';

const TIME_UPDATED_KEY = 'timeUpdated';
const ALIVE_DOMAINS_KEY = 'alive';
const DEAD_DOMAINS_KEY = 'dead';

/**
 * Extracts wildcard domains from the content of a filter.
 * @param filterContent - The content of the filter.
 * @returns A set of wildcard domains extracted from the filter content.
 */
function getWildcardDomains(filterContent: string): Set<string> {
    const rules = filterContent.split(/\r?\n/);
    const wildcardDomains = new Set<string>();
    for (const rule of rules) {
        const domains = getDomains(rule);
        const wildcardDomainsList = domains.filter((domain: string) => utils.isWildcardDomain(domain));
        wildcardDomainsList.forEach((domain: string) => wildcardDomains.add(domain));
    }
    return wildcardDomains;
}

/**
 * A map of alive wildcard domains with all possible TLDs.
 */
export type AliveWildcardDomains = Record<string, string[]>;

type WildcardDomains = {
    /**
     * Time in ISO string format when the data was updated last time.
     */
    [TIME_UPDATED_KEY]: string;

    /**
     * A map of alive wildcard domains with all possible TLDs.
     */
    [ALIVE_DOMAINS_KEY]: AliveWildcardDomains;

    /**
     * List of dead wildcard domains.
     */
    [DEAD_DOMAINS_KEY]: string[];
};

/**
 * Supplements the wildcard domains with all possible TLDs from the list.
 * @param wildcardDomains - The set of wildcard domains to supplement.
 * @returns A map of wildcard domains with all possible TLDs.
 */
function supplementWithTld(wildcardDomains: Set<string>): AliveWildcardDomains {
    const wildcardDomainsWithTld: AliveWildcardDomains = {};
    for (const wildcardDomain of wildcardDomains) {
        const baseWithoutWildcard = wildcardDomain.slice(0, -2);
        wildcardDomainsWithTld[wildcardDomain] = [];
        for (const tld of TOP_LEVEL_DOMAIN_LIST) {
            wildcardDomainsWithTld[wildcardDomain].push(`${baseWithoutWildcard}.${tld}`);
        }
    }
    return wildcardDomainsWithTld;
}

/**
 * Sleep for the specified number of milliseconds.
 *
 * @param ms The number of milliseconds to sleep.
 *
 * @returns A promise that resolves after the specified time.
 */
async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Filters out dead domains from a list of domains.
 *
 * @param domains The list of domains to filter.
 *
 * @returns A list of alive domains.
 *
 * @throws Error if dead domain finding fails after max retry attempts.
 */
async function getAliveDomains(domains: string[]): Promise<string[]> {
    const MAX_ATTEMPTS = 10;
    const RETRY_DELAY_MS = 3000; // 3 seconds

    let attempts = 0;

    while (attempts < MAX_ATTEMPTS) {
        try {
            const deadDomains = new Set(await findDeadDomains(domains));
            return domains.filter((domain) => !deadDomains.has(domain));
        } catch (error) {
            attempts += 1;

            if (attempts >= MAX_ATTEMPTS) {
                throw new Error(`Failed to find dead domains after ${MAX_ATTEMPTS} attempts: ${error}`);
            }

            console.log(`Error finding dead domains (attempt ${attempts}/${MAX_ATTEMPTS}) due to ${error}`);
            console.log(`Retrying in ${RETRY_DELAY_MS / 1000} seconds`);

            // Wait for the specified delay before retrying
            await sleep(RETRY_DELAY_MS);
        }
    }

    // This should never be reached due to the throw in the catch block,
    // but TypeScript requires a return statement
    throw new Error('Unexpected error in getAliveDomains');
}

/**
 * Reads a JSON file and returns the parsed JSON.
 *
 * @param filename JSON file name.
 *
 * @returns Parsed JSON.
 * @throws Error if the file cannot be read or parsed.
 */
async function getJson(filename: string): Promise<AliveWildcardDomains | WildcardDomains> {
    let oldJson: AliveWildcardDomains | WildcardDomains = {};
    try {
        const filePath = path.resolve(__dirname, filename);
        const json = await readFile(filePath);
        oldJson = JSON.parse(json);
        return oldJson;
    } catch (e) {
        throw new Error(`Error reading old JSON file: ${e}`);
    }
}

/**
 * Checks whether obj has 'alive' key which is marker for a new format data.
 *
 * @param obj Object to check.
 * @returns True if data is in new format.
 */
function isNewFormatData(obj: AliveWildcardDomains | WildcardDomains): obj is WildcardDomains {
    return ALIVE_DOMAINS_KEY in obj;
}

/**
 * Retrieves a valid data about previously collected alive wildcard domains.
 *
 * @param filepath Path to file.
 *
 * @returns Previously collected alive wildcard domains
 */
async function getOldValidData(filename: string): Promise<AliveWildcardDomains> {
    const oldJson = await getJson(filename);

    if (!isNewFormatData(oldJson)) {
        throw new Error('Invalid format of data');
    }

    return oldJson[ALIVE_DOMAINS_KEY];
}

/**
 * Saves a JSON file with the given data.
 *
 * @param filename JSON file name.
 * @param data Object data to save.
 */
async function saveJson(filename: string, data: WildcardDomains): Promise<void> {
    const filePath = path.resolve(__dirname, filename);
    // use tab character for indentation in JSON to decrease file size
    const content = JSON.stringify(data, null, '\t');
    await writeFile(filePath, content);
}

/**
 * Processes wildcard domains by finding, validating, and writing them to a JSON file.
 * @param filtersDir - The directory to search for filter files.
 * @param wildcardDomainsJsonFilename - The path to the JSON file where the validated wildcard domains will be written.
 * @throws Will throw an error if there are issues reading or writing files, or if dead domains cannot be found.
 */
export const updateWildcardDomains = async (
    filtersDir: string,
    wildcardDomainsJsonFilename: string,
): Promise<void> => {
    const filterFiles = await findFilterFiles(path.resolve(__dirname, filtersDir), 'filter.txt');

    const wildcardDomains = new Set<string>();
    for (const filterFile of filterFiles) {
        const filterContent = await readFile(filterFile);
        const filterWildcardDomains = getWildcardDomains(filterContent);
        filterWildcardDomains.forEach((domain) => wildcardDomains.add(domain));
    }

    const wildcardDomainsWithTld = supplementWithTld(wildcardDomains);
    const totalWildcardDomains = Object.keys(wildcardDomainsWithTld);

    const possibleTldDomains = totalWildcardDomains.reduce((acc, key) => {
        acc.push(...wildcardDomainsWithTld[key]);
        return acc;
    }, [] as string[]);

    console.log('Totally found wildcard domains:', totalWildcardDomains.length, ', check full list in log.txt');
    console.log('Possible TLD domains to check:', possibleTldDomains.length);

    await writeFile('log.txt', totalWildcardDomains.join('\n'));

    const oldAliveData = await getOldValidData(wildcardDomainsJsonFilename);

    const newAliveData = { ...oldAliveData };

    /**
     * The number of wildcard domains to process in a single batch.
     *
     * Needed to speed up the process.
     */
    const BATCH_SIZE = 50;

    const entries = Object.entries(wildcardDomainsWithTld);
    const start = performance.now();
    const timeUpdated = new Date().toISOString();
    console.log('Start finding dead domains');
    console.log(`Processing domains by batches of ${BATCH_SIZE} domains.`);

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        console.log(`In progress batch: ${i / BATCH_SIZE + 1} of ${Math.ceil(entries.length / BATCH_SIZE)}`);

        const domainsInProcess: string[] = [];

        const batchPromises = batch.map(async ([key, value]) => {
            domainsInProcess.push(key);

            const aliveDomains = await getAliveDomains(value);

            newAliveData[key] = aliveDomains;

            if (aliveDomains.length === 0) {
                console.error(`Domain ${key} has no alive domains, consider removing rules with this domain.`);
            }
        });

        console.log(`Checking wildcard domains: ${domainsInProcess.join(', ')}`);
        await Promise.all(batchPromises);
    }

    const deadWildcardDomains = totalWildcardDomains.filter((domain) => {
        const aliveWildcardDomains = Object.keys(newAliveData);
        return !aliveWildcardDomains.includes(domain);
    });

    const newData: WildcardDomains = {
        [TIME_UPDATED_KEY]: timeUpdated,
        [ALIVE_DOMAINS_KEY]: newAliveData,
        [DEAD_DOMAINS_KEY]: deadWildcardDomains,
    };

    await saveJson(wildcardDomainsJsonFilename, newData);

    if (deadWildcardDomains.length > 0) {
        console.log('Consider removing dead wildcard domains:\n', deadWildcardDomains.join('\n'));
    }

    //  Currently, we only update lists of alive domains in the JSON file and do not remove them.
    const spentTimeSec = ((performance.now() - start) / 1000).toFixed(2);
    console.log('End finding dead domains. Spent time, seconds:', spentTimeSec);
};
