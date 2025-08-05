import {
    AnyRule,
    DomainListParser,
    Modifier,
    RuleCategory,
    RuleParser,
    type CosmeticRule,
    type NetworkRule,
} from '@adguard/agtree';

import { PIPE_MODIFIER_SEPARATOR } from '@adguard/agtree/utils';
import { utils } from './utils.js';

/**
 * A list of network rule modifiers that are to be scanned for dead domains.
 */
export const DOMAIN_MODIFIERS = ['domain', 'denyallow', 'from', 'to'];

/**
 * Extracts an array of domains from the network rule modifier.
 *
 * @param modifier The modifier that contains the domains.
 * @returns The list of domains extracted from the modifier.
 */
export function extractModifierDomains(modifier: Modifier): {
    domain: string;
    negated: boolean;
}[] {
    if (!modifier?.value?.value) {
        return [];
    }

    const domains = DomainListParser.parse(modifier.value.value, {}, modifier.start, PIPE_MODIFIER_SEPARATOR);
    return domains.children.map((domain) => {
        return {
            domain: domain.value,
            negated: domain.exception,
        };
    });
}

/**
 * Extracts domains from a cosmetic rule AST.
 *
 * @param ast The AST of a cosmetic rule to extract domains from.
 * @returns The list of all domains that are used by this rule.
 */
function extractCosmeticRuleDomains(ast: CosmeticRule): string[] {
    if (!ast.domains || ast.domains.children.length === 0) {
        return [];
    }

    const domains = ast.domains.children
        .map((domain) => domain.value)
        .filter(utils.isValidDomain);

    return utils.unique(domains);
}

/**
 * Extracts domains from a network rule AST.
 *
 * @param ast The AST of a network rule to extract domains from.
 * @returns The list of all domains that are used by this rule.
 */
function extractNetworkRuleDomains(ast: NetworkRule): string[] {
    const domains: string[] = [];

    if (!ast.modifiers) {
        // No modifiers in the rule, return right away.
        return domains;
    }

    for (let i = 0; i < ast.modifiers.children.length; i += 1) {
        const modifier = ast.modifiers.children[i];

        if (DOMAIN_MODIFIERS.includes(modifier.name.value)) {
            const modifierDomains = extractModifierDomains(modifier)
                .map((domain) => domain.domain);

            domains.push(...modifierDomains);
        }
    }

    return utils.unique(domains)
        .filter(utils.isValidDomain);
}

/**
 * This function goes through the rule AST and extracts domains from it.
 *
 * @param ast The AST of the rule to extract domains from.
 * @returns The list of all domains that are used by this rule.
 */
export function extractRuleDomains(ast: AnyRule): string[] {
    switch (ast.category) {
        case RuleCategory.Network:
            if ('pattern' in ast && 'exception' in ast) {
                return extractNetworkRuleDomains(ast);
            }
            return [];
        case RuleCategory.Cosmetic:
            return extractCosmeticRuleDomains(ast);
        default:
            return [];
    }
}

/**
 * Parses a rule and extracts domains from it.
 * @param rule - The rule to extract domains from.
 * @returns An array of domains extracted from the rule.
 */
export function getDomains(rule: string): string[] {
    let ruleAst;
    try {
        ruleAst = RuleParser.parse(rule);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.log(`Unable to parse rule: "${rule}", because of the error: ${e}`);
        return [];
    }
    const domains = extractRuleDomains(ruleAst);
    return domains;
}
