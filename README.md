# AG Filters [![Build Status](https://travis-ci.org/AdguardTeam/FiltersRegistry.svg?branch=master)](https://travis-ci.org/AdguardTeam/FiltersRegistry)

## What is AdGuard?

Filters source repository

For each filter entity we have a directory in `/filters`.
In that directory we have: 
- template.txt

Template file is a main source for filter correctors. 
 
- exclude.txt

Exclusions that will be applied by default, the file could be removed if it's no needed. 

- metadata.json

Filter metadata, look metadata block

- revision.json

Filter version metadata, automatically filled and overwritten each build.

- filter.txt

Result compiled filter 

- diff.txt

Build log containing excluded rules with explaining comments 

### domains-blacklist.txt

Text file containing list of domains to be removed from url-blocking domain modified rules.

### Metadata files

- metadata.json

Example of English filter:
```
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

- /locales

Contains directories for each locale with `filters.json`, `groups.json`, `tags.json` that should be edited by filter-writers.

- /tags

Json tags metadata

## How to build

### Install

```
  npm install
```

### Building

Run the following command:
```
  node index.js
```


### Oneskyapp integration

It's important to import strings from onesky before exporting, cause some changes can be lost otherwise.

To import strings from oneskyapp, run the following in /oneskyapp scripts directory:
```
    ./download.sh $apikey $secretkey $projectid
```

To export strings to oneskyapp, run the following in /oneskyapp scripts directory:
```
    ./upload.sh $apikey $secretkey $projectid
```
