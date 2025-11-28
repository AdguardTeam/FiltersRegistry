import { parse } from 'tldts';

/**
 * Helper function that takes an array and returns a new one without any
 * duplicate items.
 *
 * @param arr The array to check for duplicates.
 * @returns Returns a new array without duplicates.
 */
function unique(arr: string[]): string[] {
    return Array.from(new Set(arr));
}

/**
 * A list of TLD that we ignore and don't check for existence for technical reasons.
 */
const ALLOW_TLD = new Set([
    'onion', // Tor
    'lib', 'coin', 'bazar', 'emc', // EmerCoin
    'bit', // Namecoin
    'sats', 'ord', 'gm', // SATS domains
]);

/**
 * Check if domain has wildcard Tld
 * @param domain Domain to check
 * @returns True if domain ends with wildcard Tld
 */
function isWildcardDomain(domain: string): boolean {
    return domain.endsWith('.*');
}

/**
 * Checks if the given domain is valid.
 *
 * @param domain The domain name to check.
 * @returns Returns true if the domain is valid, false otherwise.
 */
function isValidDomain(domain: string): boolean {
    // If the domain ends with '.*', it is a wildcard domain and it is valid.
    if (isWildcardDomain(domain)) {
        return true;
    }

    const result = parse(domain);

    if (!result?.domain) {
        return false;
    }

    if (result.isIp) {
        // IP addresses cannot be verified too so just ignore them too.
        return false;
    }

    if (result.publicSuffix && ALLOW_TLD.has(result.publicSuffix)) {
        // Do not check TLDs that are in use, but we cannot check them for
        // existence.
        return false;
    }

    if (result.domainWithoutSuffix === '') {
        // Ignore top-level domains to avoid false positives on things like:
        // https://github.com/AdguardTeam/DeadDomainsLinter/issues/6
        return false;
    }

    return true;
}

export const utils = {
    isValidDomain,
    unique,
    isWildcardDomain,
};
