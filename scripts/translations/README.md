## Filters localization

`/locales` contains translations for filters, groups, and tags.

### Translations service integration

It's important to import strings from the service before exporting as some changes can be lost otherwise.

To import strings from the service, run the following in /translations scripts directory:
```
./download.sh
```
After updated translations are downloaded, validate them:
```
yarn locales:validate
```

> For third-party filters only `REQUIRED_LOCALES` should be 100% done.

> For AdGuard filters **all locales** are required, it means 100% translated. Can be checked by `node validate.js`.

To export strings to the service, run the following in /translations scripts directory:
```
./upload.sh
```
