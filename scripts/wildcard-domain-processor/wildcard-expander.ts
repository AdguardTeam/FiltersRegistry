/* eslint-disable no-restricted-syntax,no-await-in-loop */
import path from 'path';

import agtree, {
    AnyRule,
    CosmeticRule,
    CosmeticRuleSeparator,
    DomainListParser,
    NetworkRule,
    RuleCategory,
    RuleParser,
} from '@adguard/agtree';

import { findFilterFiles, readFile, writeFile } from './file-utils';
import { WildcardDomains } from './wildcard-domains-updater';
import { DOMAIN_MODIFIERS } from './domain-extractor';
import { utils } from './utils';
import { updateContentChecksum } from '../checksum';
import { splitByLines } from '../utils/splitter';

/**
 * Expands wildcards in a network rule AST.
 * @param ast - The network rule AST to process.
 * @param wildcardDomains - A map of wildcard domains to their non-wildcard equivalents.
 * @returns The updated network rule AST with expanded wildcards, or null if no valid domains are left.
 */
function expandWildcardsInNetworkRules(
    ast: NetworkRule,
    wildcardDomains: WildcardDomains,
): NetworkRule | null {
    if (!ast.modifiers) {
        return ast;
    }

    const modifiers = ast.modifiers.children;
    const newPermittedDomains = new Map();
    const newRestrictedDomains = new Map();
    const newModifiers = [];
    let hadWildcard = false;

    for (const modifier of modifiers) {
        if (!DOMAIN_MODIFIERS.includes(modifier.modifier.value) || !modifier.value) {
            newModifiers.push(modifier);
            continue;
        }

        const domainList = DomainListParser.parse(modifier.value.value, agtree.PIPE_MODIFIER_SEPARATOR);

        for (const domain of domainList.children) {
            const isWildcard = utils.isWildcardDomain(domain.value);
            const nonWildcardDomains = wildcardDomains[domain.value];
            if (isWildcard && nonWildcardDomains) {
                hadWildcard = true;
                for (const nonWildcardDomain of nonWildcardDomains) {
                    const newDomainValue = {
                        ...domain,
                        value: nonWildcardDomain,
                    };
                    if (domain.exception) {
                        newRestrictedDomains.set(nonWildcardDomain, newDomainValue);
                    } else {
                        newPermittedDomains.set(nonWildcardDomain, newDomainValue);
                    }
                }
                continue;
            }

            if (domain.exception) {
                newRestrictedDomains.set(domain.value, domain);
            } else {
                newPermittedDomains.set(domain.value, domain);
            }
        }

        if (!hadWildcard) {
            return ast;
        }

        const newDomains = [];

        for (const [permittedKey, permittedValue] of newPermittedDomains) {
            if (newRestrictedDomains.has(permittedKey)) {
                newRestrictedDomains.delete(permittedKey);
            } else {
                newDomains.push(permittedValue);
            }
        }

        // eslint-disable-next-line @typescript-eslint/naming-convention,@typescript-eslint/no-unused-vars
        for (const [_, restrictedValue] of newRestrictedDomains) {
            newDomains.push(restrictedValue);
        }

        if (newDomains.length === 0) {
            return null;
        }

        const newDomainsModifier = {
            ...modifier,
        };

        domainList.children = newDomains;
        newDomainsModifier.value!.value = DomainListParser.generate(domainList);

        newModifiers.push(newDomainsModifier);
    }

    const newAst = structuredClone(ast);
    newAst.modifiers!.children = newModifiers;

    return newAst;
}

/**
 * Expands wildcards in a cosmetic rule AST.
 * @param ast - The cosmetic rule AST to process.
 * @param wildcardDomains - A map of wildcard domains to their non-wildcard equivalents.
 * @returns The updated cosmetic rule AST with expanded wildcards, or null if no valid domains are left.
 */
function expandWildcardsInCosmeticRules(
    ast: CosmeticRule,
    wildcardDomains: WildcardDomains,
): AnyRule | null {
    const domains = ast.domains.children;
    const newPermittedDomains = new Map();
    const newRestrictedDomains = new Map();
    let hadWildcard = false;

    for (const domain of domains) {
        const isWildcard = utils.isWildcardDomain(domain.value);
        const nonWildcardDomains = wildcardDomains[domain.value];
        if (isWildcard && nonWildcardDomains) {
            hadWildcard = true;
            nonWildcardDomains.forEach((d) => {
                const newDomain = {
                    ...domain,
                    value: d,
                };
                if (domain.exception) {
                    newRestrictedDomains.set(d, newDomain);
                } else {
                    newPermittedDomains.set(d, newDomain);
                }
            });
            continue;
        }

        if (domain.exception) {
            newRestrictedDomains.set(domain.value, domain);
        } else {
            newPermittedDomains.set(domain.value, domain);
        }
    }

    if (!hadWildcard) {
        return ast as AnyRule;
    }

    const newDomains = [];

    for (const [permittedKey, permittedValue] of newPermittedDomains) {
        if (newRestrictedDomains.has(permittedKey)) {
            newRestrictedDomains.delete(permittedKey);
        } else {
            newDomains.push(permittedValue);
        }
    }

    // eslint-disable-next-line @typescript-eslint/naming-convention,@typescript-eslint/no-unused-vars
    for (const [_, restrictedValue] of newRestrictedDomains) {
        newDomains.push(restrictedValue);
    }

    if (newDomains.length === 0) {
        return null;
    }

    const newAst = structuredClone(ast);
    newAst.domains.children = newDomains;

    return newAst as AnyRule;
}

/**
 * Expands wildcards in an AST based on its category.
 * @param ast - The AST to process.
 * @param wildcardDomains - A map of wildcard domains to their non-wildcard equivalents.
 * @returns The updated AST with expanded wildcards, or null if no valid domains are left.
 * @throws Will throw an error if the AST category is unsupported.
 */
function expandWildcardsInAst(ast: AnyRule, wildcardDomains: WildcardDomains): AnyRule | null {
    switch (ast.category) {
        case RuleCategory.Network:
            return expandWildcardsInNetworkRules(ast as NetworkRule, wildcardDomains);
        case RuleCategory.Cosmetic:
            if (ast.separator.value === CosmeticRuleSeparator.ElementHiding
                || ast.separator.value === CosmeticRuleSeparator.ElementHidingException
            ) {
                return expandWildcardsInCosmeticRules(ast as CosmeticRule, wildcardDomains);
            }
            return ast;
        case RuleCategory.Comment:
            return ast;
        default:
            throw new Error(`Unsupported rule category: ${ast.category}`);
    }
}

/**
 * Expands wildcards in a rule string.
 * @param rule - The rule string to process.
 * @param wildcardDomains - A map of wildcard domains to their non-wildcard equivalents.
 * @returns The updated rule string with expanded wildcards, or null if no valid domains are left.
 */
export function expandWildcardsInRule(rule: string, wildcardDomains: WildcardDomains): string | null {
    let ast = null;
    try {
        ast = RuleParser.parse(rule);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.debug(`Was unable to parse rule: ${rule}, because of: ${e}`);
        return rule;
    }

    const astWithExpandedWildcards = expandWildcardsInAst(ast, wildcardDomains);
    if (astWithExpandedWildcards === null) {
        return null;
    }

    if (ast === astWithExpandedWildcards) {
        return rule;
    }

    return RuleParser.generate(astWithExpandedWildcards);
}

/**
 * Patches a filter content by expanding wildcards in all rules.
 * @param filterContent - The filter content to patch.
 * @param wildcardDomains - A map of wildcard domains to their non-wildcard equivalents.
 * @returns The patched filter content with expanded wildcards.
 */
function expandWildcardDomainsInFilter(filterContent: string, wildcardDomains: WildcardDomains): string {
    const rules = splitByLines(filterContent);
    const newRules = [];
    for (const rule of rules) {
        const newRule = expandWildcardsInRule(rule, wildcardDomains);
        if (newRule !== null) {
            newRules.push(newRule);
        }
    }
    return newRules.join('');
}

/**
 * Patches platform filter files by expanding wildcards in all rules.
 * @param platformsDir - The directory containing the platform filter files.
 * @param wildcardDomainsPath - The path to the wildcard domains JSON file.
 * @returns A promise that resolves when the patching is complete.
 */
export async function expandWildcardDomains(platformsDir: string, wildcardDomainsPath: string): Promise<void> {
    const filterPaths = await findFilterFiles(
        path.resolve(__dirname, platformsDir),
        /filters[\/\\]\d+(_optimized)?\.txt/,
    );

    const wildcardDomainsFilename = path.resolve(__dirname, wildcardDomainsPath);
    const wildcardDomainsJson = await readFile(wildcardDomainsFilename);
    const wildcardDomains = JSON.parse(wildcardDomainsJson);

    for (const filterPath of filterPaths) {
        const filter = await readFile(filterPath);
        const updatedFilter = expandWildcardDomainsInFilter(filter, wildcardDomains);
        const filterWithUpdatedChecksums = updateContentChecksum(updatedFilter);
        await writeFile(filterPath, filterWithUpdatedChecksums);
    }
}
