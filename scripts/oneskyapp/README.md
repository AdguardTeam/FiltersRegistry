## Filters localization

`/locales` contains translations for filters, groups, and tags.

### Oneskyapp integration

It's important to import strings from onesky before exporting as some changes can be lost otherwise.

To import strings from oneskyapp, run the following in /oneskyapp scripts directory:
```
./download.sh $apikey $secretkey $projectid
```

To export strings to oneskyapp, run the following in /oneskyapp scripts directory:
```
./upload.sh $apikey $secretkey $projectid
```