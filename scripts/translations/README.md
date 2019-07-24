## Filters localization

`/locales` contains translations for filters, groups, and tags.

### Translations service integration

It's important to import strings from the service before exporting as some changes can be lost otherwise.

To import strings from the service, run the following in /translations scripts directory:
```
./download.sh
```

To export strings to the service, run the following in /translations scripts directory:
```
./upload.sh
```