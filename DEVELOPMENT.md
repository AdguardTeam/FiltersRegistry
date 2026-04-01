# Development Guide

## Prerequisites

- **Node.js** >= 22
- **Yarn** (Classic, v1.x)
- **Git**

## Getting Started

1. **Clone the repository**

    ```bash
    git clone <repository-url>
    cd FiltersRegistry
    ```

1. **Install dependencies**

    ```bash
    yarn install
    ```

1. **Verify the setup**

    Run the linter and tests to confirm everything works:

    ```bash
    yarn lint
    yarn test
    ```

## Development Workflow

### Building Filters

Build all filters (AdGuard + third-party) into `platforms/`:

```bash
yarn build
```

Build only specific filters by ID (short and long forms both work):

```bash
yarn build -i=1,2,3
# or
yarn build --include=1,2,3
```

Build all filters except specific ones:

```bash
yarn build -s=12,24
# or
yarn build --skip=12,24
```

Generate a build report to a custom file:

```bash
yarn build --report='report-adguard.txt'
```

### Automated Build

The `auto-build` script performs a full build with patches and wildcard domain expansion.
It supports two modes:

```bash
# Build third-party filters (default)
yarn auto-build --mode 3p

# Build AdGuard filters
yarn auto-build --mode adguard
```

### Incremental Patches

After building, generate diff patches between old and new filter versions:

```bash
yarn build:patches
```

With custom time-to-live and resolution:

```bash
yarn build:patches --time=3600 --resolution=s
```

### Wildcard Domain Processing

Scan filter sources and update the wildcard domains list:

```bash
yarn update-wildcard-domains ./filters ./scripts/wildcard-domain-processor/wildcard_domains.json
```

Expand wildcard domains in platform-specific builds (required for Chromium MV3, Safari, iOS):

```bash
yarn expand-wildcard-domains ./platforms/extension/chromium-mv3 \
    ./scripts/wildcard-domain-processor/wildcard_domains.json
```

### Linting

Run all linters (ESLint + TypeScript type check + markdownlint):

```bash
yarn lint
```

Run them individually:

```bash
yarn lint:code  # ESLint
yarn lint:types # TypeScript type check (tsc --noEmit)
yarn lint:md    # Markdownlint
```

### Testing

Run unit tests:

```bash
yarn test
```

Tests are located in `scripts/wildcard-domain-processor/__tests__/` and use Vitest.

### Validation

Validate platform build outputs and locale files:

```bash
yarn validate
```

Or individually:

```bash
yarn validate:platforms          # defaults to ./platforms
yarn validate:platforms ./platforms  # explicit path (optional)
yarn validate:locales
```

### Repository Compression

Once a year, we will compress the repository to reduce its size.
We will delete all remote branches and overwrite the master branch with a squashed history.
The compression script will retain the first N commits in their original order in the history.
All other commits (except the first one) will be squashed into a single commit.

#### How to

##### 1. Squash all old commits

```bash
yarn install
yarn compress [commits_to_keep]
```

It will retain the first `[commits_to_keep]` (default is 10000,
which is approximately one year of history) commits, starting from now,
in their original order in the history.
All other older commits (except the very first one) will be squashed into a single commit.

##### 2. Overwrite master branch

```bash
git push --set-upstream origin --force master
```

##### 3. List all remote branches

```bash
git ls-remote --heads origin
```

##### 4. Remove remote branches

Remove remote branches that are no longer needed locally
and push the removal to the remote repository:

```bash
git push origin --delete branchName
```

Replace `branchName` with the name of the branch you want to delete.

##### 5. Prune remote branches

Use git remote prune origin to remove references to remote branches that have been deleted on the remote repository.
This keeps your local repository in sync with the remote:

```bash
git remote prune origin
```

##### 6. Clean the reflog

Over time, Git can accumulate references in the reflog that are no longer needed.
You can clean the reflog using the following command:

```bash
git reflog expire --expire=now --all
git gc --aggressive --prune=now
```

This will remove unnecessary entries from the reflog and perform garbage collection.

After this procedure git repository will reduce its size.

## Common Tasks

### Adding or Editing an AdGuard Filter

1. Edit the `template.txt` in the filter's directory,
   e.g., `filters/filter_2_Base/template.txt`.
1. Update `metadata.json` if filter metadata changed.
1. Build to regenerate platform outputs: `yarn build --include=<filterID>`.
1. Validate: `yarn validate`.

### Working with Translations

Translations live in `locales/` (45+ languages). See
[scripts/translations/README.md](scripts/translations/README.md) for the full workflow:

1. Download latest translations: `cd scripts/translations && ./download.sh`
1. Validate: `yarn validate:locales`
1. Edit strings in `locales/` as needed.
1. Upload changes: `cd scripts/translations && ./upload.sh`

### Modifying Build Scripts

All build tooling lives under `scripts/`. After making changes:

1. Run `yarn lint` — fix all errors.
1. Run `yarn test` — all tests must pass.
1. If you changed `scripts/wildcard-domain-processor/`, update tests in
   `scripts/wildcard-domain-processor/__tests__/`.
1. Run `yarn validate` if the change affects filter compilation or platform outputs.

## Troubleshooting

### `yarn build` fails with missing platform files

On a fresh clone, the `platforms/` directory may not exist yet. The build script
handles this as an initial run — it creates `platforms/` and copies it to
`temp/platforms/` for future patch generation. No manual action is needed.

### `yarn lint:md` reports errors in generated files

Markdownlint runs on `**/*.md`. If it picks up files you don't control, check
`.markdownlintignore` for exclusion patterns.

### TypeScript errors on `__filename` / `__dirname`

The project uses ESM. The ESLint config allows `__filename` and `__dirname` as
variable names (they are manually derived via `fileURLToPath` / `path.dirname`).
Do not use the CommonJS globals directly.

## Additional Resources

- [AGENTS.md](AGENTS.md) — project context, code guidelines, and contribution rules
- [README.md](README.md) — project overview, filter acceptance policy, metadata format
- [scripts/translations/README.md](scripts/translations/README.md) — localization workflow
- [AdGuard knowledge base: filter syntax](https://adguard.com/kb/general/ad-filtering/create-own-filters)
