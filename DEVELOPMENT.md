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

    > **Note:** `yarn lint` runs three checks in sequence: ESLint (`yarn lint:code`),
    > TypeScript type checking (`yarn lint:types`), and Markdownlint (`yarn lint:md`).
    > All three must pass. The build scripts are a mix of JavaScript and TypeScript;
    > `tsx` executes both transparently — no manual compilation step is needed.

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

#### Additional Build Flags

The `yarn build` command (and `yarn build:local`) also accepts:

- `--no-patches-prepare` — skip copying `platforms/` to `temp/platforms/`, used
  to build patches. Speeds up the build when patch generation
  (`yarn build:patches`) is not needed afterwards.
- `--strip-generated-meta` — after compilation, remove generated meta lines
  (`! Checksum`, `! Diff-Path`, `! TimeUpdated`, `! Version`) from all filter
  files in `platforms/` and `temp/platforms/`. Useful when comparing outputs between builds.

### Generating Filter Cache

To update the cached `filter.txt` files in `filters/`, used for
testing/reproducible builds, run:

```bash
yarn generate-cache
```

This compiles every filter from its `template.txt` and updates the corresponding
`filter.txt` inside `filters/`. Platform-specific filters and patches are **not**
generated. The resulting `filter.txt` files contain the fully resolved filter
content (all `@include` and `!#include` directives expanded) and can be used to
build filters from cache with `yarn build:local`.

### Building From Cache

To build filters from previously cached `filter.txt` files without downloading
external filters, run:

```bash
yarn build:local
```

Under the hood this copies `filters/` to `temp/filters_cached/`, replaces every
`template.txt` with a single `@include "./filter.txt"` directive, and compiles
from that copy. The original `filters/` directory is never modified.

The `-i` / `-s` / `--no-patches-prepare` / `--strip-generated-meta` flags can be
combined:

```bash
yarn build:local -i=1,2,3 --no-patches-prepare --strip-generated-meta
```

**Typical workflow — comparing two compiler versions:**

1. Download and compile filter content into cache:
   `yarn generate-cache`
1. Build from cache with generated metadata lines stripped:
   `yarn build:local --no-patches-prepare --strip-generated-meta`
1. Rename the output: `mv platforms platforms_A`
1. Switch to the other compiler version
   (e.g. `yarn add @adguard/filters-compiler@...`)
1. Build again with the same flags:
   `yarn build:local --no-patches-prepare --strip-generated-meta`
1. Rename the output: `mv platforms platforms_B`
1. Diff the two directories (e.g. in Total Commander, WinMerge, or
   with `diff -r`)

Both runs use the exact same cached filter content and strip all volatile
metadata, so any difference comes solely from the compiler.

#### Command Compatibility

The following flags can be used with `yarn build` and `yarn build:local`:

- `-i=`, `--include=` — comma-separated filter IDs to build (e.g., `--include=1,2,3`)
- `-s=`, `--skip=` — comma-separated filter IDs to exclude (e.g., `--skip=12,24`)
- `--report=` — custom report file name (e.g., `--report='report-adguard.txt'`)
- `--no-patches-prepare` — skip copying `platforms/` to `temp/platforms/`
- `--strip-generated-meta` — remove volatile metadata lines from built files
- `--use-cache` — build from cached `filter.txt` (same as `yarn build:local`)
- `--generate-cache` — compile filters and update cache only (no platform files)

**Valid combinations:**

```bash
# Base builds
yarn build
yarn build:local

# Filter selection
yarn build --include=1,2,3
yarn build --skip=12,24
yarn build --include=1,2,3 --skip=2   # intersection minus exclusion. Excessive, but it works

# Report output
yarn build --report='report-adguard.txt'

# Patch and metadata control
yarn build --no-patches-prepare
yarn build --strip-generated-meta

# Combined examples
yarn build --include=1,2,3 --no-patches-prepare --strip-generated-meta
yarn build:local --skip=12,24 --report='report.txt' --strip-generated-meta

# Cache generation with filter selection
yarn build --generate-cache
yarn build --generate-cache --include=1,2,3
yarn build --generate-cache --skip=12,24
yarn build --generate-cache --report='report.txt'
```

**Invalid or ineffective combinations:**

```bash
# Mutually exclusive flags → script exits with error
yarn build --use-cache --generate-cache

# --generate-cache exits early; these flags are incompatible → script exits with error
yarn build --generate-cache --strip-generated-meta
yarn build --generate-cache --no-patches-prepare
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

After this procedure, the Git repository size will be reduced.

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

Build scripts under `scripts/` are written in JavaScript and TypeScript, executed
via [tsx](https://github.com/privatenumber/tsx) — no manual compilation step is needed.

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
