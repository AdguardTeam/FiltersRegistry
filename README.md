# AG Filters Registry

1. [Introduction](#introduction)
1. [What filters can be added to this repository](#what-filters-can-be-added-to-this-repository)
1. [About filters](#about-filters)
    1. [Metadata](#metadata)
    1. [Tags](#tags)
    1. [Groups](#groups)
    1. [Optimization](#optimization)
    1. [Compiler customization](#compiler-customization)
    1. [Localization](#localization)
    1. [Templates](#templates)
1. [How to build filters and patches](#how-to-build-filters-and-patches)
1. [Use cases](#use-cases)
    1. [Building *only AdGuard* filters and updating filters and patches](#build-adguard-filters)
    1. [Building *all* filters and updating filters and patches](#build-all-filters)
    1. [Working with locales](#working-with-locales)
    1. [Expanding wildcard domains](#expanding-wildcard-domains)
    1. [Repository compression](#repository-compression)

## Introduction

This repository contains the known filters subscriptions available to AdGuard users.
We re-host these filters on `filters.adtidy.org`.
Also, these filters can be slightly modified in order to achieve better compatibility with AdGuard.

## What filters can be added to this repository

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

## About filters

### Metadata

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

[gh-compiler-trust-levels]: https://github.com/AdguardTeam/FiltersCompiler/tree/master/src/main/utils/trust-levels
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

### Compiler customization

Script located in `scripts/build/custom_platforms.js` customizes the way filters are compiled for certain platforms.
We should use it if we need to temporary change rules for a platform.
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

## How to build filters and patches

1. **Install dependencies**

    ```bash
    yarn install
    ```

1. **Build filters and patches**:

    To build all filters, run:

    ```bash
    yarn build
    ```

    The `yarn build` command accepts two parameters:
    - `-i`: Filters to build.
    - `-s`: Filters to skip.

    For example, to build only AdGuard filters:

    ```bash
    yarn build -i=1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,224
    ```

    It takes filter templates from the `/filters` path, loads their content,
    compiles filters based on the provided whitelist and blacklist, generates log and report files,
    and creates a copy of platform files for future patch generation in `temp/platforms` to compare old and new filters.

    After every `yarn build`, yarn will execute the `postbuild` task,
    which checks all generated filters in the `platforms/` folder.
    If there are no changes in the filter except for deleting `Diff-Path` (because the compiler doesn't retrieve
    this tag from metadata and deletes it on every compile run), the script will undo these unnecessary changes.

1. **Build Patches**

    To build patches with different TTL (Time To Live) and selectively include or exclude specific filter IDs,
    use the following commands:

    - For a TTL of 10 hours:

        ```bash
        yarn build:patches --time=10 --resolution=h
        ```

    - For a TTL of 60 minutes:

        ```bash
        yarn build:patches --time=60 --resolution=m
        ```

    - For a TTL of 3000 seconds:

        ```bash
        yarn build:patches --time=3000 --resolution=s
        ```

    - To include specific filter IDs:

        ```bash
        yarn build:patches --include=1,2,3
        ```

        This includes only filters with IDs 1, 2, and 3 in the patch generation process.

    - To exclude specific filter IDs:

        ```bash
        yarn build:patches --skip=4,5
        ```

        This excludes filters with IDs 4 and 5 from the patch generation process.

    This script recursively finds new filter files in the `platforms/` folder,
    generates patches by comparing them with corresponding old filter files (from `temp/platforms`),
    and saves these patches in a designated directory.
    The `--include` and `--skip` parameters allow for selective processing of filters based on their IDs.
    After generating the patches, the script copies any existing old patches to the new filter directory
    and cleans up temporary files, facilitating the maintenance and updates of filters.

1. **Validate Platforms**

    To validate `filters.json` and `filters_i18n.json` for platforms, use the following command:

    ```bash
    yarn validate:platforms ./platforms
    ```

1. **Validate Locales**

    To validate locales, use the following command:

    ```bash
    yarn validate:locales
    ```

1. (Optional) **Combined Validation**

    Two previous steps can be combined and run with a single command:

    ```bash
    yarn validate
    ```

## <a id="use-cases"></a> Use Cases

### <a id="build-adguard-filters"></a> Building *only AdGuard* filters and updating filters and patches

1. **Install Dependencies**

    ```bash
    yarn install
    ```

1. **Run the Build Process**

    ```bash
    yarn auto-build --mode adguard
    ```

### <a id="build-all-filters"></a> Building *all* filters and updating filters and patches

1. **Install Dependencies**

    ```bash
    yarn install
    ```

1. **Run the Build Process**

    ```bash
    yarn auto-build --mode all
    ```

### Working with Locales

For information on working with locales, please refer to the [translations docs].

[translations docs]: ./scripts/translations/README.md

### Expanding wildcard domains

You can expand wildcard domains using the CLI commands provided in this project.
These commands help update and expand wildcard domains across various platforms.

More information on why this feature was needed can be found in [the related task][#964].

[#964]: https://github.com/AdguardTeam/FiltersRegistry/issues/964

1. **Install dependencies**

    ```bash
    yarn install
    ```

1. **Update wildcard domains**

    This command extracts wildcard domains from the filters, converts them to a list of domains,
    selects the alive domains, and saves the resulting map to a JSON file [wildcard_domains.json].

    ```bash
    yarn update-wildcard-domains <filtersDir> <wildcardDomainsFile>
    ```

    - **Arguments**:

        - `<filtersDir>` — directory containing the filter files.
        - `<wildcardDomainsFile>` — filename for the wildcard domains JSON.

    - **Example**:

    ```bash
    yarn update-wildcard-domains filters scripts/wildcard-domain-processor/wildcard_domains.json
    ```

1. **Expand wildcard domains**

    This command processes platform filters and expands wildcard domains
    based on the previously generated map in the file [wildcard_domains.json].

    ```bash
    yarn expand-wildcard-domains <platformsDir> <wildcardDomainsFile>
    ```

    - **Arguments**:

        - `<platformsDir>` — directory containing the platform files.
        - `<wildcardDomainsFile>` — filename for the wildcard domains JSON.

    - **Example**:

    ```bash
    yarn expand-wildcard-domains platforms scripts/wildcard-domain-processor/wildcard_domains.json
    ```

[wildcard_domains.json]: ./scripts/wildcard-domain-processor/wildcard_domains.json

### CLI commands help

To see the help information for each command, you can use the `-h` option:

- **Update wildcard domains help**:

```bash
yarn update-wildcard-domains -h
```

- **Expand wildcard domains help**:

```bash
yarn expand-wildcard-domains -h
```

These commands must be run from the root directory of the project,
and the directories specified will be resolved relative to the current working directory.

### Repository compression

Once a year, we will compress the repository to reduce its size.
We will delete all remote branches and overwrite the master branch with a squashed history.
The compression script will retain the first N commits in their original order in the history.
All other commits (except the first one) will be squashed into a single commit.

#### How to

##### 1. Squash all old commits

```bash
yarn install
yarn compress [commits_to_keep]
```

It will retain the first `[commits_to_keep]` (default is 10000,
which is approximately one year of history) commits, starting from now, in their original order in the history.
All other older commits (except the very first one) will be squashed into a single commit.

##### 2. Overwrite master branch

```bash
git push --set-upstream origin --force master
```

##### 3. List all remote branches

```bash
git ls-remote --heads origin
```

##### 4. Remove remote branches

Remove remote branches that are no longer needed locally
and push the removal to the remote repository:

```bash
git push origin --delete branchName
```

Replace `branchName` with the name of the branch you want to delete.

##### 5. Prune remote branches

Use git remote prune origin to remove references to remote branches that have been deleted on the remote repository.
This keeps your local repository in sync with the remote:

```bash
git remote prune origin
```

##### 6. Clean the reflog

Over time, Git can accumulate references in the reflog that are no longer needed.
You can clean the reflog using the following command:

```bash
git reflog expire --expire=now --all
git gc --aggressive --prune=now
```

This will remove unnecessary entries from the reflog and perform garbage collection.

After this procedure git repository will reduce it's size.

[gh-compiler-include-directive]: https://github.com/AdguardTeam/FiltersCompiler#include-directive
