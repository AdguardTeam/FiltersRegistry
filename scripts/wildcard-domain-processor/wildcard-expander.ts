/* eslint-disable no-restricted-syntax,no-await-in-loop */
import path from 'path';

import agtree, {
    AdblockSyntax,
    AnyRule,
    CosmeticRule,
    CosmeticRuleSeparator,
    DomainListParser,
    EmptyRule,
    FilterListParser,
    NetworkRule,
    RuleCategory,
    RuleParser,
} from '@adguard/agtree';

import { findFilterFiles, readFile, writeFile } from './file-utils';
import { WildcardDomains } from './wildcard-domains-updater';
import { DOMAIN_MODIFIERS } from './domain-extractor';
import { utils } from './utils';
import { updateContentChecksum } from '../checksum';

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
    wildcardDomains: WildcardDomains,
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
        if (!DOMAIN_MODIFIERS.includes(modifier.modifier.value) || !modifier.value) {
            newModifiers.push(modifier);
            continue;
        }

        let domainList;
        try {
            domainList = DomainListParser.parse(modifier.value.value, agtree.PIPE_MODIFIER_SEPARATOR);
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
 * @returns The updated cosmetic rule AST with expanded wildcards, null if no valid domains are left, or empty rule if
 * all domains were eliminated.
 */
function expandWildcardsInCosmeticRules(
    ast: CosmeticRule,
    wildcardDomains: WildcardDomains,
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
export function expandWildcardsInAst(ast: AnyRule, wildcardDomains: WildcardDomains): AnyRule | null {
    switch (ast.category) {
        case RuleCategory.Network:
            return expandWildcardsInNetworkRules(ast as NetworkRule, wildcardDomains);
        case RuleCategory.Cosmetic:
            // Expand only element hiding rules and exceptions since these kinds of rules
            // are supported natively in Safari content blockers.
            // And other cosmetic rule types, e.g. scriptlets in MV3
            // https://github.com/AdguardTeam/FiltersRegistry/issues/1063,
            // should not be expanded as they are to be applied by tswebextension where wildcards are not a problem.
            if (ast.separator.value === CosmeticRuleSeparator.ElementHiding
                || ast.separator.value === CosmeticRuleSeparator.ElementHidingException
            ) {
                return expandWildcardsInCosmeticRules(ast as CosmeticRule, wildcardDomains);
            }
            return null;
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
export function expandWildcardDomainsInFilter(filterContent: string, wildcardDomains: WildcardDomains): string {
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
                newAst.raws.text = RuleParser.generate(newAst);

                listAst.children[i] = newAst;
            } else if (newAst.category === RuleCategory.Empty) {
                listAst.children.splice(i, 1);
            }
        }
    }

    return agtree.FilterListParser.generate(listAst, true);
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
