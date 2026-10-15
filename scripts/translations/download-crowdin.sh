#!/bin/bash
set -euo pipefail
# Downloads translations from Crowdin via the Crowdin CLI instead of the
# Twosky gateway. Requires the CROWDIN_PERSONAL_TOKEN environment variable
# (see crowdin.yml api_token_env). The script resolves every path from its own
# location, so it can be run from any directory (CI runs it from
# scripts/translations, `yarn run` from the repo root).
# Uploading strings to the service is a manual step done via upload.sh.

# The repo root, resolved from the script's own location.
scriptDir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$scriptDir"
workDir="$(cd "$scriptDir/../.." && pwd)"
crowdinDir="$workDir/temp/crowdin"
crowdinConfig="$workDir/crowdin.yml"
# converter.js resolves its file arguments against scripts/translations
# (path.join(__dirname, file)), so the paths passed to it must be relative.
crowdinDirRel="../../temp/crowdin"
convertedFile="converted.json"

# The files exported per locale and the converter.js mask for each of them.
# Keep in sync with the `files:` section of crowdin.yml: an unexpected file in
# a downloaded locale dir is a hard error, so a file added to the config but
# not to this list fails the run instead of being silently skipped.
files=("tags.json" "groups.json" "filters.json")
masks=("tag." "group." "filter.")

# Locales this repo keeps under a second, base alias dir next to the Crowdin
# one: the Twosky-based download.sh fetched es/pt and copied them to
# es_ES/pt_PT, and the base dirs are still required by validate_locales.ts and
# consumed by the compiler. The freshly imported regional files are copied back
# to the aliases after the import, so the aliases cannot go stale.
# Format: <imported locale>:<base alias>
baseLocaleAliases=(
    "es_ES:es"
    "pt_PT:pt"
)

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
importedLocales=""
aliased=0
aliasedLocales=""

# Import the locale dirs the download produced. `export_languages` and
# `languages_mapping` in crowdin.yml decide which locales are exported and how
# their dirs are named, so the config stays the single source for the language
# set and this script needs no locale list of its own: a language added there is
# downloaded and imported, and a dropped one stops being imported.
# (`source` is the config's source dir, not a locale.)
while IFS= read -r locale; do
    echo "Importing $locale locale"
    # Fail on files this script does not know: a file added to the `files:`
    # section of crowdin.yml would otherwise be downloaded but silently not
    # imported, so the config and this script would drift apart.
    unexpected=""
    for downloadedFile in "$crowdinDir/$locale"/*; do
        [ -f "$downloadedFile" ] || continue
        name="$(basename "$downloadedFile")"
        case " ${files[*]} " in
            *" $name "*) ;;
            *) unexpected="$unexpected $name" ;;
        esac
    done
    if [ -n "$unexpected" ]; then
        echo "Error: unexpected file(s) in the downloaded $locale dir:$unexpected" >&2
        echo 'Check the "files" section of crowdin.yml against the "files" list in this script' >&2
        exit 1
    fi

    for i in "${!files[@]}"; do
        file="${files[$i]}"
        if [ ! -f "$crowdinDir/$locale/$file" ]; then
            echo "Error: $locale/$file was not downloaded (missing from $crowdinDir/$locale)" >&2
            echo 'Check the "files" section of crowdin.yml against the downloaded archive' >&2
            exit 1
        fi
        node "$scriptDir/converter.js" import "$crowdinDirRel/$locale/$file" "$locale" "$convertedFile" "${masks[$i]}"
        mkdir -p "$workDir/locales/$locale"
        cp -f "$convertedFile" "$workDir/locales/$locale/$file"
        rm -f "$convertedFile"
        imported=$((imported + 1))
    done
    importedLocales="$importedLocales $locale"
done < <(find "$crowdinDir" -mindepth 1 -maxdepth 1 -type d ! -name source -exec basename {} \; | sort)

if [ "$imported" -eq 0 ]; then
    echo "Error: no translations were downloaded" >&2
    exit 1
fi

# Refresh the base alias locales (see baseLocaleAliases). The copies happen
# here, after the import, and are skipped when the alias dir was downloaded on
# its own, so a genuine download can never be overwritten by an alias copy.
for alias in "${baseLocaleAliases[@]}"; do
    aliasSource="${alias%%:*}"
    aliasTarget="${alias##*:}"
    aliasTargetDownloaded=false
    for file in "${files[@]}"; do
        if [ -f "$crowdinDir/$aliasTarget/$file" ]; then
            aliasTargetDownloaded=true
        fi
    done
    if [ "$aliasTargetDownloaded" = true ]; then
        echo "Skip $aliasTarget alias: downloaded on its own"
        continue
    fi
    # Only refresh the alias from files this run actually imported: the
    # committed locales/ dirs always exist in a checkout, so checking them
    # could never fire and stale files would be copied over silently.
    case " $importedLocales " in
        *" $aliasSource "*) ;;
        *)
            echo "Error: cannot refresh the $aliasTarget locale: $aliasSource was not imported by this run" >&2
            exit 1
            ;;
    esac
    echo "Copying $aliasSource translations to the base $aliasTarget locale"
    mkdir -p "$workDir/locales/$aliasTarget"
    for file in "${files[@]}"; do
        cp -f "$workDir/locales/$aliasSource/$file" "$workDir/locales/$aliasTarget/$file"
    done
    aliased=$((aliased + 1))
    aliasedLocales="$aliasedLocales $aliasTarget"
done

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
    case " $importedLocales $aliasedLocales " in
        *" $localeName "*) ;;
        *) staleLocales="$staleLocales $localeName" ;;
    esac
done

if [ -n "$staleLocales" ]; then
    echo "Warning: repo locale dirs not refreshed by this run:$staleLocales" >&2
    echo "Check export_languages in crowdin.yml or remove the stale dirs" >&2
fi

echo "Imported locales:$importedLocales"
echo "Import finished: $imported files imported, $aliased base locales refreshed"
