# Localization of Filters

The `/locales` directory contains translations for filters, groups, and tags.

## Requirements

1. For third-party filters, only [`REQUIRED_LOCALES`](../validation/validate_locales.ts) should be 100% complete.

1. For AdGuard filters, **all locales** are required, meaning they must be 100% translated.

## Integration with Translation Service

Translations are stored in the Crowdin project `adguard-applications` (project ID 17570) under
the `miscellaneous/filters-registry` folder. The Crowdin CLI (configured in the root `crowdin.yml`)
is used to download and upload strings; the legacy Twosky-based `download.sh`/`upload.sh` scripts
are kept for reference but no longer used by the CI workflow.

The Crowdin CLI reads the API token from the `CROWDIN_PERSONAL_TOKEN` environment variable, so it
must be set before running the scripts (in CI it is provided by the `CROWDIN_PERSONAL_TOKEN`
repository secret).

It's essential to import strings from the service before exporting them, as some changes may be lost otherwise.

1. **Install dependencies in the root directory:**

    ```bash
    yarn install
    ```

1. **Download the Latest Translations:**

    To import strings from the service, navigate to the `translations` scripts directory and run the following command:

    ```bash
    cd scripts/translations
    CROWDIN_PERSONAL_TOKEN="YOURTOKEN" ./download-crowdin.sh
    ```

    The script stages the `en` source files, uploads them to Crowdin (to keep the export pattern
    in sync with `crowdin.yml`), downloads translations for all configured locales, and converts
    them into the repo format under `locales/`.

1. **Validate Translations:**

    After downloading updated translations, go back to the root and validate them using the following command:

    ```bash
    cd ../..
    yarn validate:locales
    ```

    It will validate the existence and correctness of certain locale files in `locales/` folder.

1. **Make Changes:**

    Edit translation strings in the `/locales` folder as needed.

1. **Validate Changes:**

    After making changes, validate them again using the following command:

    ```bash
    yarn validate:locales
    ```

1. **Upload Strings:**

    To export strings to the service, navigate to the `/translations` scripts directory and run the following command:

    ```bash
    CROWDIN_PERSONAL_TOKEN="YOURTOKEN" ./upload-crowdin.sh
    ```

    The script converts the `en` source files from `locales/en/` and uploads them to Crowdin.

1. (optional) **Validate builded platforms:**

    After compiling filters into platforms, validate their locales by schema using the following command:

    ```bash
    yarn validate:platforms
    ```

    It will validate the JSON schema of filter rules for different platforms in a project.

## Automatic Updates

The `Update translations` GitHub Actions workflow
(`.github/workflows/update-translations.yaml`) runs `download-crowdin.sh` weekly and on demand
(authenticated with the `CROWDIN_PERSONAL_TOKEN` repository secret),
validates the result with `yarn validate:locales`, and opens a pull request with the
changes to `locales/`. Trigger it manually from the Actions tab. Uploading base English
strings (`upload-crowdin.sh`) stays a manual step.

The pull request is created with the default `GITHUB_TOKEN`, so it does not trigger the
regular CI workflows; the update job itself runs `yarn validate:locales`, `yarn lint`,
and `yarn test`, and reports failures via the Slack notification.
