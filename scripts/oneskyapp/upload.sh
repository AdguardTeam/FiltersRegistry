#!/bin/bash
apikey=$1
secretkey=$2
projectid=$3
workDir=../..
locales=("en")

for locale in "${locales[@]}"
do
    echo "Moving tags.json for $locale locale"
    cp -f $workDir/locales/$locale/tags.json messages.json

    echo "Exporting tags.json for $locale locale"
    node converter.js export messages.json $locale tags.json

    echo "Uploading tags.json for $locale locale"
    python upload.py -l $locale -p $projectid -f tags.json -a $apikey -s $secretkey -r HIERARCHICAL_JSON

    rm messages.json
    rm tags.json
done

for locale in "${locales[@]}"
do
    echo "Moving groups.json for $locale locale"
    cp -f $workDir/locales/$locale/groups.json messages.json

    echo "Exporting groups.json for $locale locale"
    node converter.js export messages.json $locale groups.json

    echo "Uploading groups.json for $locale locale"
    python upload.py -l $locale -p $projectid -f groups.json -a $apikey -s $secretkey -r HIERARCHICAL_JSON

    rm messages.json
    rm groups.json
done

for locale in "${locales[@]}"
do
    echo "Moving filters.json for $locale locale"
    cp -f $workDir/locales/$locale/filters.json messages.json

    echo "Exporting filters.json for $locale locale"
    node converter.js export messages.json $locale filters.json

    echo "Uploading filters.json for $locale locale"
    python upload.py -l $locale -p $projectid -f filters.json -a $apikey -s $secretkey -r HIERARCHICAL_JSON

    rm messages.json
    rm filters.json
done

echo "Upload finished"