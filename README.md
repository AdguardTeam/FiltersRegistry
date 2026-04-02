# AdGuard Filters Registry

AdGuard Filters Registry is the canonical repository of filter list subscriptions
available to AdGuard users. It stores AdGuard's own filters and re-hosted
third-party filter lists served via `filters.adtidy.org`. Filters can be slightly
modified in order to achieve better compatibility with AdGuard.

The build pipeline compiles filter templates into platform-specific outputs
for 8 AdGuard product platforms (Android, CLI, Extension, iOS, Mac, Mac v2,
Mac v3, Windows), generates incremental patches, and produces localized metadata.

## Table of Contents

- [Third-Party Filter Acceptance Policy](#third-party-filter-acceptance-policy)
- [Filters Reference](#filters-reference)
    - [Filter Directory Structure](#filter-directory-structure)
    - [Tags](#tags)
    - [Groups](#groups)
    - [Optimization](#optimization)
    - [Compiler Customization](#compiler-customization)
    - [Localization](#localization)
    - [Templates](#templates)
- [Wildcard Domain Expansion](#wildcard-domain-expansion)
- [Repository Compression](#repository-compression)
- [Documentation](#documentation)

## Third-Party Filter Acceptance Policy

We may add third-party filters to AdGuard Filters Registry. When making a decision about adding a third-party filter,
we follow these rules:

1. The filter should be oriented towards browser content blockers.
2. The filter should be legal. If it has rules for paywall circumvention, we won't add such a filter.
3. The filter should have a place for receiving user complaints and holding discussions,
  such as a repository on github.com, or a website open to public.
4. The filter should be relatively popular, meaning:
    - if there is a repository on GitHub, the number of stars should be at least 50;
    - if there is no repository on GitHub, the number of analyzed issues and discussions is estimated
      at 10 per month on the filter's website;
    - the filter should be actively supported for at least 6 months.
5. The filter should be regularly updated with at least 10 updates per month.
6. The filter should be compatible with AdGuard products.
  You can familiarize yourself with AdGuard syntax in our [knowledge base][kb-rules-syntax].
7. If the filter works only in some operating systems and satisfies all other criteria,
  it will be added but only for the supported platforms.
8. Previously added filters that haven't received any support for a year will be removed.
  We reserve the right to remove the filter earlier, depending on circumstances.
9. If the filter contains too many problematic rules, it will not be added.
  A rule is considered problematic if it causes false positives or otherwise displays unintended behavior.
  Decisions about filters with problematic rules are arbitrary
  and there may be exceptions (see items 9 and 10, for example).
    - If the filter intentionally blocks or restricts access to any services for no reason other than being
    a reflection of the filter author's opinion, the filter will not get added, or will get removed if already added.
10. If the filter is popular in a specific region and there are no alternatives to it, then it can be added as is.
11. If the filter gets added, it receives a so-called [trustLevel](#trustLevel) (Low, High, Full),
  based on the number of problematic rules it contains and some other factors.
  Filters without "Full" trust level may have part of their rules disabled.
    - The trust level of a filter can be re-reviewed and raised if the author improves the filter over time.
12. If there are two or more similar filters that satisfy all other criteria,
  they all may be added if they don't duplicate each other and don't conflict with each other.
  If there is a large amount of conflicting or duplicate rules,
  the filter with more matches on such rules gets the priority.

[kb-rules-syntax]: https://adguard.com/kb/general/ad-filtering/create-own-filters

## Filters Reference

Each filter lives in its own directory under `filters/` (AdGuard filters)
or `filters/ThirdParty/` (third-party filters).

### Filter Directory Structure

Every filter directory contains these files:

- `template.txt`

    [Template file](#templates) is used by the filters compiler to prepare the final filter version.

- `exclude.txt`

    A list of regular expressions. Rules that match these exclusions will not be included in the resulting filter.

- `metadata.json`

    Filter metadata. Includes name, description, etc.

    - `filterId` — number, unique filter identifier.
    - `name` — string, filter name; can be localized.
    - `description` — string, filter description.
    - `timeAdded` — number, time when this filter was added to the registry; milliseconds since January 1, 1970;
      you can exec `new Date().getTime()` in the browser console to get the current time.
    - `homepage` — string, filter website or homepage.
    - `deprecated` — optional, boolean, filter is *deprecated* but still available and being built as usual,
      i.e. **not removed**. The flag shows that the filter list is no longer relevant
      and should not be used by the products.
      Final decision what to do with such filter is up to the product, e.g. simple hiding, disabling, or migration.
    - `disabled` — optional, boolean, filter is disabled, i.e. *removed*, its building will be skipped
      and it will not be available to download. If used, the `obsolete` [tag](#tags) should be used as well.
    - `expires` — string, filter's default expiration period.
      used as filter update interval if "Default" is chosen for according setting in AdGuard product.
    - `displayNumber` — number, this number is used when AdGuard sorts available filters (GUI).
    - `groupId` — number, [group](#groups) identifier.
    - `subscriptionUrl` — optional, string, makes sense only for third-party lists that come from the registry.
      The idea is that these lists are re-hosted by the registry and downloaded not from the source url.
    - `downloadUrl` — string, main filter download url.
    - `tags` — string array, a list of [tags](#tags).
    - <a id="trustLevel"></a> `trustLevel` — string, level of trust
      which describes [allowed and permitted rules types][gh-compiler-trust-levels].
      Please note that the trust level can be ignored for same origin files,
      more details can be found in the [`@include` directive documentation][gh-compiler-include-directive].
      Possible values:
        - `low` — only low-risk rule types are allowed; defaults to **low** if trust level is not configured at all;
        - `high` — trusted third-party filter lists; some particular rules from there are still permitted;
        - `full` — all types of filter rules are allowed; only AdGuard filter lists have full trust at the moment.
    - `platformsIncluded` — string array, [the list of platforms][kb-hint-platforms] to compile the filter for,
      e.g. `["mac", "windows", "android"]`. If you need to compile the filter for all platforms remove this property.
    - `platformsExcluded` — string array, [the list of platforms][kb-hint-platforms] to skip while filter compiling,
      e.g. `["ios", "ext_safari"]`. If you need to compile the filter for all platforms remove this property.

    > ⚠️ **Warning**:
    >
    > 1. Both `platformsIncluded` and `platformsExcluded` should not be set in filter's metadata simultaneously.
    > 1. `deprecated` and `disabled` flags are not the same:
    >    - If you want to leave the filter available but believe it is no longer relevant
    >      and probably will be removed later, use the `deprecated` flag.
    >    - If you want to remove the filter from the registry and stop building it,
    >      use the `disabled` metadata flag with the `obsolete` tag.

    <details>
        <summary>Metadata example</summary>

    ```json
    {
        "filterId": 2,
        "name": "AdGuard Base filter",
        "description": "EasyList + AdGuard English filter. This filter is necessary for quality ad blocking.",
        "timeAdded": 1404115015843,
        "homepage": "https://adguard.com/kb/general/ad-filtering/adguard-filters/",
        "expires": "4 days",
        "displayNumber": 1,
        "groupId": 1,
        "subscriptionUrl": "https://filters.adtidy.org/extension/chromium/filters/2.txt",
        "tags": [
            "purpose:ads",
            "reference:101",
            "recommended",
            "reference:2"
        ],
        "trustLevel": "full",
        "platformsIncluded": [
            "windows",
            "mac",
            "android",
            "ext_ublock"
        ]
    }
    ```
    </details>

- `revision.json`

    Filter version metadata, automatically filled and overwritten on each build.

- `filter.txt`

    Resulting compiled filter.

- `diff.txt`

    Build log that contains excluded and converted rules with an explanation.

- `trusted-rules.txt`

    This file contains rules that are excluded by the filters compiler based on the specified trustLevel.

[kb-hint-platforms]: https://adguard.com/kb/general/ad-filtering/create-own-filters/#platform-and-not_platform-hints

### <a id="tags"></a> Tags

Every filter can be marked by a number of tags. Every tag metadata listed in `/tags/metadata.json`.

<details>
    <summary>Example</summary>

```json
{
    "tagId": 1,
    "keyword": "purpose:ads"
}
```

</details>

Possible tags:

- `lang:*` — for language-specific filters; one or multiple lang-tags can be used.
  For instance, *AdGuard French filter* is marked with the `lang:fr` tag.
- `purpose:*` — determines filters purposes; multiple purpose-tags can be used for one filter list.
  For instance, *AdGuard DNS filter* is marked with both `purpose:ads` and `purpose:privacy`.
- `recommended` — for low-risk filter lists which are recommended to use in their category.
  The category is determined by the pair of the `lang:*` and `purpose:*` tags.
- `obsolete` — for abandoned filter lists; defaults to `false`;
  If set to `true`, filter's metadata will be excluded from `filters.json` and `filters_i18n.json`.

### <a id="groups"></a> Groups

`/groups/metadata.json` — filters groups metadata. Each filter should belong to one of the groups.

### Optimization

For each filter, AdGuard compiles two versions: full and optimized.

Optimized version is much more lightweight and does not contain rules which are not used at all or used rarely.

Rules usage frequency comes from the collected [filter rules statistics][kb-filter-statistics],
thanks to the volunteers who enabled it in their AdGuard.

`optimization_config.json` - defines the target for the optimization process.
AdGuard will attempt to compress the lists by removing the least frequently used rules
until the compression goal (defined in percentages) is achieved.

> [!NOTE]
> However, these changes will only take effect after being uploaded to the server,
> as `filters-compiler` does not use this file locally but retrieves it from the server.

[kb-filter-statistics]: https://adguard.com/kb/general/ad-filtering/tracking-filter-statistics/

### Compiler Customization

Script located in `scripts/build/custom_platforms.js` customizes the way filters are compiled for certain platforms.
We should use it if we need to temporarily change rules for a platform.
In all other cases, we should prefer the default configuration.

Below is a example of the configuration for the platform `AdGuard for Chrome` with comments:

```javascript
"EXTENSION_CHROMIUM": {
    // Defines the platform for which the settings are specified.
    "platform": "ext_chromium",
    // Defines the path that can be used to access the settings or resources associated with this platform.
    "path": "extension/chromium",
    // Overrides the expires value set in the filter metadata (for this platform).
    "expires": "12 hours",
    "configuration": {
        // Sets an array of regular expressions that will be used to remove certain rules.
        "removeRulePatterns": [
            "^((?!#%#).)*\\$\\$|\\$\\@\\$",
            "\\$(.*,)?replace=",
            "important,replace=",
            "\\$(.*,)?app",
            "\\$network",
            "\\$protobuf",
            "important,protobuf",
            "\\$extension",
            ",extension"
        ],
        // Sets an array of objects that will be used to replace certain values.
        "replacements": [
            {
                "from": ":has\\(",
                "to": ":-abp-has("
            }
        ],
        // Specifies whether to ignore hints for rules. A value of "false" means that hints will not be ignored.
        "ignoreRuleHints": false
    },
    "defines": {
        "adguard": true,
        "adguard_ext_chromium": true
    }
},
```

### Localization

If you want to help with filters translations, you can join us on Crowdin:
<https://crowdin.com/project/adguard-applications/en#/miscellaneous/filters-registry>.

Please learn more about translating our products: <https://adguard.com/kb/miscellaneous/contribute/translate/program/>

### <a id="templates"></a> Templates

`@include` directive allows to include the content of specified file into the filter.

More information about the `@include` directive and its options
can be found in [its documentation][gh-compiler-include-directive].

## Wildcard Domain Expansion

Some filter rules use wildcard domains (e.g., `domain.*`). The build pipeline can expand
these wildcards into actual live domains for platforms that require it
(Chromium MV3, Safari, iOS).

The expansion process uses the `expandWildcardsInAst` function to process rules
in the Abstract Syntax Tree (AST) format. It handles different rule categories:

- **Network Rules** — all network rules with wildcard domains are expanded.
- **Cosmetic Rules** — only element hiding rules and their exceptions are expanded
  since these are natively supported in Safari content blockers.
  Other cosmetic rules (like scriptlets) are not expanded
  because wildcards are automatically handled by:
    - Advanced Blocking in Safari browser;
    - tswebextension in Browser extension MV3.

The wildcard domain map is stored in
[wildcard_domains.json](./scripts/wildcard-domain-processor/wildcard_domains.json),
where keys are wildcard domains (e.g., `domain.*`) and values contain arrays of
live domains (e.g., `["domain.com", "domain.org"]`).

The list of supported top level domains (TLD) is limited by default. To add a new TLD,
update [top-tld.ts](./scripts/wildcard-domain-processor/top-tld.ts).

More information on why this feature was needed can be found in [the related task][#964].

[#964]: https://github.com/AdguardTeam/FiltersRegistry/issues/964

For build commands, see [Development Guide](DEVELOPMENT.md#wildcard-domain-processing).

## Repository Compression

For the compression procedure and commands, see
[Development Guide](DEVELOPMENT.md#repository-compression).

## Documentation

- [Development Guide](DEVELOPMENT.md) — development setup, build commands, and workflow
- [LLM Agent Rules](AGENTS.md) — project context, code guidelines, and contribution rules
- [Translations](scripts/translations/README.md) — localization workflow
- [AdGuard knowledge base: filter syntax][kb-rules-syntax]
- [AdGuard knowledge base: filter statistics][kb-filter-statistics]
- [Filters compiler: trust levels][gh-compiler-trust-levels]
- [Filters compiler: @include directive][gh-compiler-include-directive]

[gh-compiler-include-directive]: https://github.com/AdguardTeam/FiltersCompiler#include-directive
[gh-compiler-trust-levels]: https://github.com/AdguardTeam/FiltersCompiler/tree/master/src/main/utils/trust-levels
