#!/bin/bash
apikey=$1
secretkey=$2
projectid=$3
workDir=../..
locales=("en" "ru" "ar" "bg" "ca" "zh" "zh_TW" "hr" "da" "nl" "fi" "fr" "de" "he" "hu" "id" "it" "ja" "ko" "no" "fa" "pl" "pt" "pt_BR" "pt_PT" "sr_Latn" "sk" "es_ES" "sv" "tr" "uk" "vi")

for locale in "${locales[@]}"
do
    echo "Download tags.json for $locale locale"
    python download.py -l $locale -p $projectid -o messages.json -f tags.json -a $apikey -s $secretkey

    destinationLocale=$locale
    if [ "$locale" = "sr_Latn" ]; then
        echo "Change $locale destination dir to sr"
        destinationLocale=sr
    fi

    echo "Parsing tags.json for $locale locale for tags.json"
    node converter.js import messages.json $locale converted.json "tag."

    echo "Moving tags.json for $locale locale to $workDir/locales/$destinationLocale/"
    cp -f converted.json $workDir/locales/$destinationLocale/tags.json

    if [ "$locale" = "es_ES" ]; then
        echo "Moving tags.json for es locale"
        cp -f converted.json $workDir/locales/es/tags.json
    fi

    if [ "$locale" = "pt_PT" ]; then
        echo "Moving tags.json for pt locale"
        cp -f converted.json $workDir/locales/pt/tags.json
    fi

    rm messages.json
    rm converted.json

done

for locale in "${locales[@]}"
do
    echo "Download groups.json for $locale locale"
    python download.py -l $locale -p $projectid -o messages.json -f groups.json -a $apikey -s $secretkey

    destinationLocale=$locale
    if [ "$locale" = "sr-Latn" ]; then
        echo "Change $locale destination dir to sr"
        destinationLocale=sr
    fi

    echo "Parsing groups.json for $locale locale for groups.json"
    node converter.js import messages.json $locale converted.json "group."

    echo "Moving groups.json for $locale locale to $workDir/locales/$destinationLocale/"
    cp -f converted.json $workDir/locales/$destinationLocale/groups.json

    if [ "$locale" = "es_ES" ]; then
        echo "Moving groups.json for es locale"
        cp -f converted.json $workDir/locales/es/groups.json
    fi

    if [ "$locale" = "pt_PT" ]; then
        echo "Moving groups.json for pt locale"
        cp -f converted.json $workDir/locales/pt/groups.json
    fi

    rm messages.json
    rm converted.json

done

for locale in "${locales[@]}"
do
    echo "Download filters.json for $locale locale"
    python download.py -l $locale -p $projectid -o messages.json -f filters.json -a $apikey -s $secretkey

    destinationLocale=$locale
    if [ "$locale" = "sr-Latn" ]; then
        echo "Change $locale destination dir to sr"
        destinationLocale=sr
    fi

    echo "Parsing filters.json for $locale locale for filters.json"
    node converter.js import messages.json $locale converted.json "filter."

    echo "Moving filters.json for $locale locale to $workDir/locales/$destinationLocale/"
    cp -f converted.json $workDir/locales/$destinationLocale/filters.json

    if [ "$locale" = "es_ES" ]; then
        echo "Moving filters.json for es locale"
        cp -f converted.json $workDir/locales/es/filters.json
    fi

    if [ "$locale" = "pt_PT" ]; then
        echo "Moving filters.json for pt locale"
        cp -f converted.json $workDir/locales/pt/filters.json
    fi

    rm messages.json
    rm converted.json

done

echo "Import finished"