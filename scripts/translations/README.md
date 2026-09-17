# Localization of Filters

The `/locales` directory contains translations for filters, groups, and tags.

## Requirements

1. For third-party filters, only [`REQUIRED_LOCALES`](../validation/validate_locales.js) should be 100% complete.

1. For AdGuard filters, **all locales** are required, meaning they must be 100% translated.

## Integration with Translation Service

It's essential to import strings from the service before exporting them, as some changes may be lost otherwise.

1. **Install dependencies in the root directory:**

    ```bash
    yarn install
    ```

1. **Download the Latest Translations:**

    To import strings from the service, navigate to the `translations` scripts directory and run the following command:

    ```bash
    cd scripts/translations
    ./download.sh
    ```

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
    ./upload.sh
    ```

1. (optional) **Validate builded platforms:**

    After compiling filters into platforms, validate their locales by schema using the following command:

    ```bash
    yarn validate:platforms
    ```

    It will validate the JSON schema of filter rules for different platforms in a project.
