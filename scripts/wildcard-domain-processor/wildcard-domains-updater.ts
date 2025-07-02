/* eslint-disable no-await-in-loop,no-restricted-syntax,no-console */
import * as path from 'path';
// There is no type definition available for the following import.
// @ts-ignore
import { findDeadDomains } from '@adguard/dead-domains-linter/src/urlfilter';
import { getDomains } from './domain-extractor';
import { utils } from './utils';
import { TOP_LEVEL_DOMAIN_LIST } from './top-tld';
import { findFilterFiles, readFile, writeFile } from './file-utils';

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
        const wildcardDomainsList = domains.filter((domain) => utils.isWildcardDomain(domain));
        wildcardDomainsList.forEach((domain) => wildcardDomains.add(domain));
    }
    return wildcardDomains;
}

/**
 * A map of wildcard domains with all possible TLDs.
 */
export type WildcardDomains = Record<string, string[]>;

/**
 * Supplements the wildcard domains with all possible TLDs from the list.
 * @param wildcardDomains - The set of wildcard domains to supplement.
 * @returns A map of wildcard domains with all possible TLDs.
 */
function supplementWithTld(wildcardDomains: Set<string>): WildcardDomains {
    const wildcardDomainsWithTld: WildcardDomains = {};
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
 * Filters out dead domains from a list of domains.
 * @param domains - The list of domains to filter.
 * @returns A list of alive domains.
 */
async function getAliveDomains(domains: string[]): Promise<string[]> {
    const deadDomains = new Set(await findDeadDomains(domains));
    return domains.filter((domain) => !deadDomains.has(domain));
}

/**
 * Reads a JSON file and returns the parsed JSON.
 *
 * @param filename JSON file name.
 *
 * @returns Parsed JSON.
 * @throws Error if the file cannot be read or parsed.
 */
async function getJson(filename: string): Promise<WildcardDomains> {
    let oldJson: WildcardDomains = {};
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

    console.log('Totally found wildcard domains:', totalWildcardDomains.length);
    console.log('Possible TLD domains to check:', possibleTldDomains.length);

    const oldJson = await getJson(wildcardDomainsJsonFilename);

    const newData = { ...oldJson };

    /**
     * The number of domains to process in a single batch.
     *
     * Needed to speed up the process.
     */
    const BATCH_SIZE = 50;

    const entries = Object.entries(wildcardDomainsWithTld);
    const start = performance.now();
    console.log('Start finding dead domains');
    console.log(`Processing domains by batches of ${BATCH_SIZE} domains.`);

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        console.log(`In progress batch: ${i / BATCH_SIZE + 1} of ${Math.ceil(entries.length / BATCH_SIZE)}`);

        const domainsInProcess: string[] = [];

        const batchPromises = batch.map(async ([key, value]) => {
            domainsInProcess.push(key);

            const aliveDomains = await getAliveDomains(value);

            newData[key] = aliveDomains;

            if (aliveDomains.length === 0) {
                console.error(`Domain ${key} has no alive domains, consider removing rules with this domain.`);
            }
        });

        console.log(`Checking wildcard domains: ${domainsInProcess.join(', ')}`);
        await Promise.all(batchPromises);
    }

    await saveJson(wildcardDomainsJsonFilename, newData);

    // TODO: Add removal of domains that should be removed from the list of wildcard domains
    //  Currently, we only update lists of alive domains in the JSON file and do not remove them.
    const spentTimeSec = ((performance.now() - start) / 1000).toFixed(2);
    console.log('End finding dead domains. Spent time, seconds:', spentTimeSec);
};
