# AG Filters Registry

This repository contains the known filters subscriptions available to AdGuard users. We re-host these filters on `filters.adtidy.org`. Also, these filters can be slightly modified in order to achieve better compatibility with AdGuard.
## What filters can be added to this repository

We may add third-party filters to AdGuard Filters Registry. When making a decision about adding a third-party filter, we follow these rules:

1. The filter should be oriented towards browser content blockers.
2. The filter should be legal. If it has rules for paywall circumvention, we won't add such a filter.
3. The filter should have a place for receiving user complaints and holding discussions, such as a repository on github.com, or a website open to public.
4. The filter should be relatively popular, meaning:
    * if there is a repository on GitHub, the number of stars should be at least 50
    * if there is no repository on GitHub, the number of analyzed issues and discussions is estimated at 10 per month on the filter's website
    * the filter should be actively supported for at least 6 months
5. The filter should be regularly updated with at least 10 updates per month.
6. The filter should be compatible with AdGuard products. You can familiarize yourself with AdGuard syntax here: https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters.
7. If the filter works only in some operating systems and satisfies all other criteria, it will be added but only for the supported platforms.
8. Previously added filters that haven't received any support for a year will be removed. We reserve the right to remove the filter earlier, depending on circumstances.
9. If the filter contains too many problematic rules, it will not be added. A rule is considered problematic if it causes false positives or otherwise displays unintended behavior. Decisions about filters with problematic rules are arbitrary and there may be exceptions (see items 9 and 10, for example).
    * If the filter intentionally blocks or restricts access to any services for no reason other than being a reflection of the filter author's opinion, the filter will not get added, or will get removed if already added.
10. If the filter is popular in a specific region and there are no alternatives to it, then it can be added as is.
11. If the filter gets added, it receives a so-called [trustLevel](#trustLevel) (Low, High, Full), based on the number of problematic rules it contains and some other factors. Filters without "Full" trust level may have part of their rules disabled.
    * The trust level of a filter can be re-reviewed and raised if the author improves the filter over time.
12. If there are two or more similar filters that satisfy all other criteria, they all may be added if they don't duplicate each other and don't conflict with each other. If there is a large amount of conflicting or duplicate rules, the filter with more matches on such rules gets the priority.
## Filters metadata

- `template.txt`

    Template file is used by the filters compiler to prepare the final filter version.

- `exclude.txt`

    A list of regular expressions. Rules that match these exclusions will not be included in the resulting filter.

- `metadata.json`

    Filter metadata. Includes name, description, etc.

    * `filterId` — unique filter identifier (integer)
    * `name` — filter name; can be localized
    * `description` — filter description
    * `timeAdded` — time when this filter was added to the registry; milliseconds since January 1, 1970; you can exec `new Date().getTime()` in the browser console to get the current time
    * `homepage` — filter website/homepage
    * `expires` — filter's default expiration period
    * `displayNumber` — this number is used when AdGuard sorts available filters (GUI)
    * `groupId` — [group](#groups) identifier
    * `subscriptionUrl` — default filter subscription URL
    * `tags` — a list of [tags](#tags)
    * <a id="trustLevel"></a> `trustLevel` — level of trust which describe [allowed and permitted rules types](https://github.com/AdguardTeam/FiltersCompiler/tree/master/src/main/utils/trust-levels); possible values:
        * `low` — only low-risk rule types are allowed; defaults to **low** if trust level is not configured at all
        * `high` — trusted third-party filter lists; some particular rules from there are still permitted
        * `full` — all types of filter rules are allowed; only AdGuard filter lists have full trust at the moment
    * `platformsIncluded` — [the list of platforms](https://kb.adguard.com/general/how-to-create-your-own-ad-filters#platform-and-not_platform-hints) to compile the filter for, e.g. `["mac", "windows", "android"]`. If you need to compile the filter for all platforms remove this property
    * `platformsExcluded` — [the list of platforms](https://kb.adguard.com/general/how-to-create-your-own-ad-filters#platform-and-not_platform-hints) to skip while filter compiling, e.g. `["ios", "ext_safari"]`. If you need to compile the filter for all platforms remove this property

    > Note please that both `platformsIncluded` and `platformsExcluded` should not be set in filter's metadata simultaneously.

    <details>
      <summary>Metadata example</summary>

    ```json
    {
      "filterId": 2,
      "name": "AdGuard Base filter",
      "description": "EasyList + AdGuard English filter. This filter is necessary for quality ad blocking.",
      "timeAdded": 1404115015843,
      "homepage": "https://kb.adguard.com/general/adguard-ad-filters#english",
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

### <a id="tags"></a> Tags

Every filter can be marked by a number of tags. Every tag metadata listed in `/tags/metadata.json`.

<details>
  <summary>Example</summary>

```json
{
    "tagId": 1,
    "keyword": "purpose:ads"
  },
```
</details>

Possible tags:
* `lang:*` — for language-specific filters; one or multiple lang-tags can be used. For instance, AdGuard Russian filter is marked with the `lang:ru` tag.

* `purpose:*` — determines filters purposes; multiple purpose-tags can be used for one filter list. For instance, `List-KR` is marked with both `purpose:ads` and `purpose:privacy`.

* `recommended` — for low-risk filter lists which are recommended to use in their category. The category is determined by the pair of the `lang:*` and `purpose:*` tags.

* `obsolete` — for abandoned filter lists; filter's metadata with this tag will be excluded from `filters.json` and `filters_i18n.json`.
### <a id="groups"></a> Groups

`/groups/metadata.json` — filters groups metadata. Each filter should belong to one of the groups.

## Filters optimization

For each filter, AdGuard compiles two versions: full and optimized. Optimized version is much more lightweight and does not contain rules which are not used at all or used rarely. Rules usage frequency comes from the collected [filter rules statistics](https://kb.adguard.com/en/general/filter-rules-statistics) (thanks to the volunteers who enabled it in their AdGuard).

* `optimization_config.json` - defines the target for the optimization process. AdGuard will try to compress the lists by removing the most rarely used rules until the compression goal (defined in percents) is met.

## Filters localization

If you want to help with filters translations, you can join us on Crowdin: https://crowdin.com/project/adguard-applications/en#/miscellaneous/filters-registry

Please learn more about translating our products: https://kb.adguard.com/general/adguard-translations

## How to build

```
yarn install
```

Run the following command:
```
node index.js
```

Build with white/black lists:
```
node index.js -i=1,2,3 -s=4,5,6
```

Validate `filters.json` and `filters_i18n.json` for platforms:
```
node validate ./platforms
```

> For AdGuard filters **all locales** are required, it means 100% translated.

Validate locales:
```
yarn locales:validate
```

> For third-party filters only `REQUIRED_LOCALES` should be 100% done.
