#!/bin/bash
set -euo pipefail
# Downloads translations from Crowdin via the Crowdin CLI instead of the
# Twosky gateway. Requires the CROWDIN_PERSONAL_TOKEN environment variable
# (see crowdin.yml api_token_env). Run from the scripts/translations dir.
workDir=../..
crowdinDir="$workDir/temp/crowdin"
crowdinConfig="$workDir/crowdin.yml"

# keep the list alphabetically sorted; the dir names are the repo locale dirs
# after the languages_mapping in crowdin.yml (zh-CN is stored as `zh`)
locales=(
    "ar" "be" "bg" "ca" "cs" "da" "de" "el" "es"
    "fa" "fi" "fr" "he" "hi" "hr" "hu" "hy" "id" "it"
    "ja" "ko" "lt" "mk" "ms" "nl" "no" "pl" "pt" "pt_BR"
    "pt_PT" "ro" "ru" "sk" "sl" "sr" "sv" "th" "tr" "uk"
    "vi" "zh" "zh_TW"
)

# Stage the en source files in the strings format Crowdin stores; the CLI
# resolves the project files against these paths (see `dest` in crowdin.yml)
# and uploads them so the export patterns stay in sync with the translation
# pattern (see the "Downloaded translations don't match" CLI FAQ).
mkdir -p "$crowdinDir/source"
for file in tags groups filters; do
    node converter.js export "$workDir/locales/en/$file.json" en "$crowdinDir/source/$file.json"
done

echo "Uploading sources"
yarn -s crowdin upload sources --config "$crowdinConfig"

echo "Downloading translations"
yarn -s crowdin download --config "$crowdinConfig"

for locale in "${locales[@]}"; do
    echo "Importing $locale locale"
    for spec in "tags.json:tag." "groups.json:group." "filters.json:filter."; do
        file="${spec%%:*}"
        mask="${spec##*:}"
        if [ ! -f "$crowdinDir/$locale/$file" ]; then
            echo "Skip $locale/$file: not downloaded"
            continue
        fi
        node converter.js import "$crowdinDir/$locale/$file" "$locale" converted.json "$mask"
        mkdir -p "$workDir/locales/$locale"
        cp -f converted.json "$workDir/locales/$locale/$file"
        rm converted.json
    done

    # es_ES is a copy of es; pt_PT also receives pt's tags and groups as a
    # fallback when the pt-PT language has no own download (mirrors download.sh).
    if [ "$locale" = "es" ]; then
        echo "Copying es translations to es_ES"
        mkdir -p "$workDir/locales/es_ES"
        for file in tags.json groups.json filters.json; do
            cp -f "$workDir/locales/es/$file" "$workDir/locales/es_ES/$file"
        done
    fi

    if [ "$locale" = "pt" ]; then
        echo "Copying pt translations to pt_PT"
        mkdir -p "$workDir/locales/pt_PT"
        for file in tags.json groups.json; do
            cp -f "$workDir/locales/pt/$file" "$workDir/locales/pt_PT/$file"
        done
    fi
done

echo "Import finished"
