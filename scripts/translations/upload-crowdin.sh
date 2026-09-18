#!/bin/bash
set -euo pipefail
# Uploads the en sources to Crowdin via the Crowdin CLI instead of the Twosky
# gateway. Requires the CROWDIN_PERSONAL_TOKEN environment variable (see
# crowdin.yml api_token_env). Run from the scripts/translations dir.
workDir=../..
crowdinDir="$workDir/temp/crowdin"
crowdinConfig="$workDir/crowdin.yml"

mkdir -p "$crowdinDir/source"
for file in tags groups filters; do
    node converter.js export "$workDir/locales/en/$file.json" en "$crowdinDir/source/$file.json"
done

echo "Uploading sources"
yarn -s crowdin upload sources --config "$crowdinConfig"

echo "Upload finished"
