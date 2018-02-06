# AG Filters Registry [![Build Status](https://travis-ci.org/AdguardTeam/FiltersRegistry.svg?branch=master)](https://travis-ci.org/AdguardTeam/FiltersRegistry)

This repository contains the known filters subscriptions available to AdGuard users. We re-host these filters on `filters.adtidy.org`. Also, these filters can be slightly modified in order to achieve better compatibility with AdGuard.

## Filters metadata

- `template.txt`

    Template file is used by the filters compiler to prepare the final filter version.
 
- `exclude.txt`

    A list of regular expressions. Rules that match these exclusions will not be included in the resulting filter.

- `metadata.json`

    Filter metadata. Includes name, description, etc.

    * `filterId` - unique filter identifier (integer);
    * `name` - filter name. Can be localized (we'll cover it later);
    * `description` - filter description;
    * `timeAdded` - time when this filter was added to the registry. Milliseconds since January 1, 1970. You can exec `new Date().getTime()` in the browser console to get the current time;
    * `homepage` - filter website/homepage;
    * `expires` - filter's default expiration period;
    * `displayNumber` - this number is used when AdGuard sorts available filters (GUI);
    * `groupId` - group identifier (see groups description below);
    * `subscriptionUrl` - default filter subscription URL
    * `tags` - a list of tags (see tags description below)

    Metadata example:
    ```javascript
    {
      "filterId": 2,
      "name": "English Filter",
      "description": "EasyList + AdGuard English filter. This filter is necessary for quality ad blocking.",
      "timeAdded": 1404115015843,
      "homepage": "https://kb.adguard.com/en/general/adguard-ad-filters#english",
      "expires": "1 day",
      "displayNumber": 1,
      "groupId": 1,
      "subscriptionUrl": "https://filters.adtidy.org/extension/chromium/filters/2.txt",
      "tags": [
        "purpose:ads",
      "reference:101",
      "recommended",
      "reference:2"
      ]
    }
    ```

- `revision.json`

  Filter version metadata, automatically filled and overwritten on each build.

- `filter.txt`

  Resulting compiled filter.

- `diff.txt`

  Build log that contains excluded and converted rules with an explanation.

### domains-blacklist.txt

Text file containing list of domains to be removed from url-blocking domain modified rules.

### Tags

- `/tags`

Json tags metadata;

### Groups

- `/groups`

Filters groups metadata;

### Filters localization

- /locales

Contains directories for each locale with `filters.json`, `groups.json`, `tags.json` that should be edited by filter-writers.

## How to build

```
npm install
```

Run the following command:
```
  node index.js
```

## Oneskyapp integration

It's important to import strings from onesky before exporting as some changes can be lost otherwise.

To import strings from oneskyapp, run the following in /oneskyapp scripts directory:
```
./download.sh $apikey $secretkey $projectid
```

To export strings to oneskyapp, run the following in /oneskyapp scripts directory:
```
./upload.sh $apikey $secretkey $projectid
```
