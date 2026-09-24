#!/bin/bash
set -euo pipefail
# Downloads translations from Crowdin via the Crowdin CLI instead of the
# Twosky gateway. Requires the CROWDIN_PERSONAL_TOKEN environment variable
# (see crowdin.yml api_token_env). Run from the scripts/translations dir.
# Uploading strings to the service is a manual step done via upload.sh.
workDir=../..
crowdinDir="$workDir/temp/crowdin"
crowdinConfig="$workDir/crowdin.yml"

# The files exported per locale and the converter.js mask for each of them.
# Keep in sync with the `files:` section of crowdin.yml.
files=("tags.json" "groups.json" "filters.json")
masks=("tag." "group." "filter.")

# Clean up the previous download first: a file the current run no longer
# produces (removed from the project, locale dropped) would otherwise stay
# in temp/crowdin and be re-imported, keeping stale translations alive.
echo "Cleaning previous downloads"
rm -rf "$crowdinDir"

echo "Downloading translations"
# --all makes the CLI match the configured files against the server-side
# project files (by dest) instead of the local source paths, which are not
# staged in this repo (there is no upload step).
yarn -s crowdin download --all --config "$crowdinConfig"

if [ ! -d "$crowdinDir" ]; then
    echo "Error: the download produced no files: $crowdinDir does not exist" >&2
    exit 1
fi

imported=0
skipped=0
importedLocales=""
emptyLocales=""

# Import the locale dirs the download produced. `export_languages` and
# `languages_mapping` in crowdin.yml decide which locales are exported and how
# their dirs are named, so the config stays the single source for the language
# set and this script needs no locale list of its own: a language added there is
# downloaded and imported, and a dropped one stops being imported.
# (`source` is the config's source dir, not a locale.)
while IFS= read -r locale; do
    echo "Importing $locale locale"
    localeImported=0
    for i in "${!files[@]}"; do
        file="${files[$i]}"
        if [ ! -f "$crowdinDir/$locale/$file" ]; then
            echo "Skip $locale/$file: not downloaded"
            skipped=$((skipped + 1))
            continue
        fi
        node converter.js import "$crowdinDir/$locale/$file" "$locale" converted.json "${masks[$i]}"
        mkdir -p "$workDir/locales/$locale"
        cp -f converted.json "$workDir/locales/$locale/$file"
        rm converted.json
        imported=$((imported + 1))
        localeImported=$((localeImported + 1))
    done
    if [ "$localeImported" -eq 0 ]; then
        # A downloaded locale dir without a single expected file means the
        # archive layout no longer matches this script.
        emptyLocales="$emptyLocales $locale"
    else
        importedLocales="$importedLocales $locale"
    fi
done < <(find "$crowdinDir" -mindepth 1 -maxdepth 1 -type d ! -name source -exec basename {} \; | sort)

if [ "$imported" -eq 0 ]; then
    echo "Error: no translations were downloaded" >&2
    exit 1
fi

if [ -n "$emptyLocales" ]; then
    echo "Error: no expected file found in the downloaded dirs of:$emptyLocales" >&2
    echo 'Check the "files" section of crowdin.yml against the downloaded archive' >&2
    exit 1
fi

# Report the repo locale dirs this run did not refresh. A locale Crowdin stops
# exporting (dropped from export_languages, no longer translated) would
# otherwise keep its committed translations forever without any signal, as
# validate_locales.ts only checks the dirs that exist.
staleLocales=""
for localeDir in "$workDir"/locales/*/; do
    if [ ! -d "$localeDir" ]; then
        continue
    fi
    localeName="$(basename "$localeDir")"
    case " $importedLocales " in
        *" $localeName "*) ;;
        *) staleLocales="$staleLocales $localeName" ;;
    esac
done

if [ -n "$staleLocales" ]; then
    echo "Warning: repo locale dirs not refreshed by this run:$staleLocales" >&2
    echo "Check export_languages in crowdin.yml or remove the stale dirs" >&2
fi

echo "Imported locales:$importedLocales"
echo "Import finished: $imported files imported, $skipped skipped"
