#!/bin/bash
SERVICE_URL="https://twosky.int.agrd.dev/api/v1/"
workDir=../..

# keep the list alphabetically sorted
locales=(
    "ar"
    "be"
    "bg"
    "ca"
    "cs"
    "da"
    "de"
    "el"
    "en"
    "es"
    "fa"
    "fi"
    "fr"
    "he"
    "hi"
    "hr"
    "hu"
    "hy"
    "id"
    "it"
    "ja"
    "ko"
    "lt"
    "mk"
    "ms"
    "nl"
    "no"
    "pl"
    "pt"
    "pt_BR"
    "pt_PT"
    "ro"
    "ru"
    "sk"
    "sl"
    "sr"
    "sv"
    "th"
    "tr"
    "uk"
    "vi"
    "zh_CN"
    "zh_TW"
)

for locale in "${locales[@]}"
do
    echo "Download tags.json for $locale locale"
    curl "${SERVICE_URL}download?format=strings&language=${locale}&filename=tags.json&project=filters-registry" -o messages.json

    destinationLocale=$locale
    if [ "$locale" = "zh_CN" ]; then
        echo "Change $locale destination dir to zh"
        destinationLocale=zh
    fi

    mkdir -p $workDir/locales/$destinationLocale

    echo "Parsing tags.json for $locale locale for tags.json"
    node converter.js import messages.json $locale converted.json "tag."

    echo "Moving tags.json for $locale locale to $workDir/locales/$destinationLocale/"
    cp -f converted.json $workDir/locales/$destinationLocale/tags.json

    if [ "$locale" = "es" ]; then
        echo "Copying tags.json for es_ES locale"
        cp -f converted.json $workDir/locales/es_ES/tags.json
    fi

    if [ "$locale" = "pt" ]; then
        echo "Copying tags.json for pt_PT locale"
        cp -f converted.json $workDir/locales/pt_PT/tags.json
    fi

    rm messages.json
    rm converted.json
done

for locale in "${locales[@]}"
do
    echo "Download groups.json for $locale locale"
    curl "${SERVICE_URL}download?format=strings&language=${locale}&filename=groups.json&project=filters-registry" -o messages.json

    destinationLocale=$locale
    if [ "$locale" = "zh_CN" ]; then
        echo "Change $locale destination dir to zh"
        destinationLocale=zh
    fi

    echo "Parsing groups.json for $locale locale for groups.json"
    node converter.js import messages.json $locale converted.json "group."

    echo "Moving groups.json for $locale locale to $workDir/locales/$destinationLocale/"
    cp -f converted.json $workDir/locales/$destinationLocale/groups.json

    if [ "$locale" = "es" ]; then
        echo "Copying groups.json for es_ES locale"
        cp -f converted.json $workDir/locales/es_ES/groups.json
    fi

    if [ "$locale" = "pt" ]; then
        echo "Copying groups.json for pt_PT locale"
        cp -f converted.json $workDir/locales/pt_PT/groups.json
    fi

    rm messages.json
    rm converted.json
done

for locale in "${locales[@]}"
do
    echo "Download filters.json for $locale locale"
    curl "${SERVICE_URL}download?format=strings&language=${locale}&filename=filters.json&project=filters-registry" -o messages.json

    destinationLocale=$locale
    if [ "$locale" = "zh_CN" ]; then
        echo "Change $locale destination dir to zh"
        destinationLocale=zh
    fi

    echo "Parsing filters.json for $locale locale for filters.json"
    node converter.js import messages.json $locale converted.json "filter."

    echo "Moving filters.json for $locale locale to $workDir/locales/$destinationLocale/"
    cp -f converted.json $workDir/locales/$destinationLocale/filters.json

    if [ "$locale" = "es" ]; then
        echo "Copying filters.json for es locale"
        cp -f converted.json $workDir/locales/es_ES/filters.json
    fi

    if [ "$locale" = "pt" ]; then
        echo "Copying filters.json for pt_PT locale"
        cp -f converted.json $workDir/locales/pt/filters.json
    fi

    rm messages.json
    rm converted.json
done

echo "Import finished"
