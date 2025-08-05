/* eslint-disable no-restricted-syntax,no-await-in-loop */
import path from 'path';

import {
    AdblockSyntax,
    AnyRule,
    CosmeticRule,
    CosmeticRuleSeparator,
    EmptyRule,
    NetworkRule,
    RuleCategory,
} from '@adguard/agtree';

import { PIPE_MODIFIER_SEPARATOR } from '@adguard/agtree/utils';

import { FilterListGenerator, RuleGenerator } from '@adguard/agtree/generator';

import { FilterListParser, DomainListParser } from '@adguard/agtree/parser';

import { findFilterFiles, readFile, writeFile } from './file-utils.js';
import { type AliveWildcardDomains } from './wildcard-domains-updater.js';
import { DOMAIN_MODIFIERS } from './domain-extractor.js';
import { utils } from './utils.js';
import { updateContentChecksum } from '../checksum/index.js';

const EMPTY_RULE: EmptyRule = {
    syntax: AdblockSyntax.Adg,
    type: 'EmptyRule',
    category: RuleCategory.Empty,
};

/**
 * Expands wildcards in a network rule AST.
 * @param ast - The network rule AST to process.
 * @param wildcardDomains - A map of wildcard domains to their non-wildcard equivalents.
 * @returns The updated network rule AST with expanded wildcards, null if no changes were made or empty ast if all
 * domains were eliminated
 */
function expandWildcardsInNetworkRules(
    ast: NetworkRule,
    wildcardDomains: AliveWildcardDomains,
): NetworkRule | EmptyRule | null {
    if (!ast.modifiers) {
        return ast;
    }

    const modifiers = ast.modifiers.children;
    const newPermittedDomains = new Map();
    const newRestrictedDomains = new Map();
    const newModifiers = [];
    let hadWildcard = false;

    for (const modifier of modifiers) {
        if (!DOMAIN_MODIFIERS.includes(modifier.name.value) || !modifier.value) {
            newModifiers.push(modifier);
            continue;
        }

        let domainList;
        try {
            domainList = DomainListParser.parse(modifier.value.value, {}, modifier.start, PIPE_MODIFIER_SEPARATOR);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.log(`Can not parse domains in the rule: ${ast.raws?.text}, because of error ${e}`);
            continue;
        }

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
            return null;
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
            return EMPTY_RULE;
        }

        const newDomainsModifier = {
            ...modifier,
        };

        domainList.children = newDomains;
        if (!domainList?.raw) {
            return EMPTY_RULE;
        }
        newDomainsModifier.value!.value = domainList.raw;

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
 * @returns The updated cosmetic rule AST with expanded wildcards, null if no valid domains are left, or empty rule if
 * all domains were eliminated.
 */
function expandWildcardsInCosmeticRules(
    ast: CosmeticRule,
    wildcardDomains: AliveWildcardDomains,
): AnyRule | EmptyRule | null {
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
        return null;
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
        return EMPTY_RULE;
    }

    const newAst = structuredClone(ast);
    newAst.domains.children = newDomains;

    return newAst as AnyRule;
}

/**
 * Expands wildcards in an AST based on its category.
 * @param ast - The AST to process.
 * @param wildcardDomains - A map of wildcard domains to their non-wildcard equivalents.
 * @returns The updated AST with expanded wildcards, null if no changes were made or empty rule if all domains
 * were eliminated.
 * @throws Will throw an error if the AST category is unsupported.
 */
export function expandWildcardsInAst(ast: AnyRule, wildcardDomains: AliveWildcardDomains): AnyRule | null {
    switch (ast.category) {
        case RuleCategory.Network:
            return expandWildcardsInNetworkRules(ast as NetworkRule, wildcardDomains);
        case RuleCategory.Cosmetic: {
            /**
             * Expand only element hiding rules and their exceptions since these kinds of rules
             * are supported natively in Safari content blockers.
             *
             * Other cosmetic rules, e.g. scriptlets, are automatically handled by:
             * - Advanced Blocking in Safari browser;
             * - tswebextension in Browser extension MV3.
             *
             * In both cases wildcards are not expanded in filters.
             * @see {@link https://github.com/AdguardTeam/FiltersRegistry/issues/1063}
             */
            const shouldExpandCosmeticRule = ast.separator.value === CosmeticRuleSeparator.ElementHiding
                || ast.separator.value === CosmeticRuleSeparator.ElementHidingException;

            if (shouldExpandCosmeticRule) {
                return expandWildcardsInCosmeticRules(ast as CosmeticRule, wildcardDomains);
            }

            return null;
        }
        case RuleCategory.Comment:
        case RuleCategory.Empty:
        case RuleCategory.Invalid:
            return null;
        default:
            throw new Error(`Unsupported rule category in the ast: ${ast}`);
    }
}

/**
 * Patches a filter content by expanding wildcards in all rules.
 * @param filterContent - The filter content to patch.
 * @param wildcardDomains - A map of wildcard domains to their non-wildcard equivalents.
 * @returns The patched filter content with expanded wildcards.
 */
export function expandWildcardDomainsInFilter(filterContent: string, wildcardDomains: AliveWildcardDomains): string {
    const listAst = FilterListParser.parse(filterContent);

    if (!listAst.children || listAst.children.length === 0) {
        return filterContent;
    }

    for (let i = listAst.children.length - 1; i >= 0; i -= 1) {
        const ruleAst = listAst.children[i];

        const newAst = expandWildcardsInAst(ruleAst, wildcardDomains);

        if (newAst) {
            if (newAst.raws) {
                // Make sure that the new rule will be re-built.
                newAst.raws.text = RuleGenerator.generate(newAst);

                listAst.children[i] = newAst;
            } else if (newAst.category === RuleCategory.Empty) {
                listAst.children.splice(i, 1);
            }
        }
    }

    return FilterListGenerator.generate(listAst, true);
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
