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
`filter.txt` inside `filters/`. It does not touch optimization stats — use
`yarn download-stats` for that. Platform-specific filters and patches are **not**
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

Optimization stats are picked up automatically: if `temp/optimization/stats`
(from a prior `yarn download-stats` run) exists, it's used as-is; otherwise
stats are fetched from the remote server during the build.
If a filter listed in the local cache is missing its `stats.json`, the build
fails with a message pointing at `yarn download-stats`.

The `-i` / `-s` / `--no-patches-prepare` / `--strip-generated-meta` flags can be
combined:

```bash
yarn build:local -i=1,2,3 --no-patches-prepare --strip-generated-meta
```

### Typical workflow — comparing build results against master

Use this when branch changes may alter compiled rule output
and you need a structured pass/fail comparison against master:

```bash
yarn compare-build-output
```

It prompts for the branch to compare (defaulting to the current branch;
`master` itself is never offered as a choice); for the build mode — a plain
`build`, or `build:local` from cached sources, the latter with separate
follow-up prompts for running `generate-cache` and `download-stats` first;
for an optional filter-ID selection (`--include` / `--skip`, forwarded to
every build command so a quick check can build a handful of filters); and
for whether to remove the build artifacts when finished. Under the hood it
builds `master` and the compare branch
in parallel via git worktrees under `temp/`, with a progress spinner on the
slow steps (install, build, copy, restore, cleanup); it also resets the
compare worktree's `filters/` to the master version first, so `revision.json`
version counters start from the same point and don't show up as diff noise in
the report. With `filters/` pinned, the tool compares build-tooling changes
through their effect on the platform output, not filter content.

Two more things it does around the build:

- Each worktree's `platforms/` is emptied before its build and restored to
  the checked-out state afterwards, so the copied output is only what this
  run compiled (matters with a `--include` / `--skip` selection).
- If cleanup was chosen, the last step removes the two worktrees, the two
  `platforms_*_build/` directories and `temp/reg-meta.env`; `temp/logs/` is
  always kept.

Two conveniences on repeated runs:

- If `temp/platforms_master_build/` and `temp/platforms_changed_build/` hold
  built output from a previous run, it prints the branches, build mode and
  the commit SHAs that output was built from — flagging any branch that has
  moved on since — and offers to generate the report from them instead of
  rebuilding.
- If a worktree from a previous run is still present, it offers to reuse it
  instead of removing and re-adding it. `yarn install` still runs either way
  (fast against the kept `node_modules`).

### Command Compatibility

The following flags can be used with `yarn build` and `yarn build:local`:

- `-i=`, `--include=` — comma-separated filter IDs to build (e.g., `--include=1,2,3`)
- `-s=`, `--skip=` — comma-separated filter IDs to exclude (e.g., `--skip=12,24`).
  Can be combined with `--include`: a filter is built only if it's in `--include`
  and not in `--skip`.
- `--report=` — custom report file name (e.g., `--report='report-adguard.txt'`)
- `--no-patches-prepare` — skip copying `platforms/` to `temp/platforms/`
- `--strip-generated-meta` — remove volatile metadata lines from built files
- `--use-cache` — build from cached `filter.txt` (same as `yarn build:local`)
- `--generate-cache` — compile filters to update the `filter.txt` cache only
- `--download-stats` — download each filter's `stats.json` without recompiling `filter.txt`.
  Fetches into a temp directory and, once every fetch succeeds, replaces the whole local stats
  directory — not a per-filter merge into the existing cache. `--include` / `--skip` scope which
  filters are fetched, so a scoped `--download-stats` drops every other filter's cached stats;
  pair it with an equally scoped build. `--report`, `--strip-generated-meta`, and
  `--no-patches-prepare` error here, since none of them apply to a run that produces no
  platform output.

**Valid combinations:**

```bash
# Base builds
yarn build
yarn build:local

# Filter selection
yarn build --include=1,2,3
yarn build --skip=12,24

# Report output
yarn build --report='report-adguard.txt'

# Patch and metadata control
yarn build --no-patches-prepare
yarn build --strip-generated-meta

# Combined examples
yarn build --include=1,2,3 --no-patches-prepare --strip-generated-meta
yarn build:local --skip=12,24 --report='report.txt' --strip-generated-meta
yarn build --include=1,2,3 --skip=2

# Cache generation with filter selection
yarn build --generate-cache
yarn build --generate-cache --include=1,2,3
yarn build --generate-cache --skip=12,24
yarn build --generate-cache --report='report.txt'

# Stats-only download, no recompile (replaces the whole local stats cache)
yarn build --download-stats
# Scoped download replaces the cache with just these filters — pair with a matching scoped build
yarn build --download-stats --include=1,2,3 && yarn build:local --include=1,2,3
yarn build --download-stats --skip=12,24 && yarn build:local --skip=12,24
```

**Invalid or ineffective combinations:**

```bash
# Mutually exclusive flags → script exits with error
yarn build --use-cache --generate-cache
yarn build --use-cache --download-stats
yarn build --generate-cache --download-stats

# --generate-cache exits early; these flags are incompatible → script exits with error
yarn build --generate-cache --strip-generated-meta
yarn build --generate-cache --no-patches-prepare

# --download-stats produces no platform output; these flags are incompatible → script exits with error
yarn build --download-stats --strip-generated-meta
yarn build --download-stats --no-patches-prepare
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

Tests use Vitest and live alongside the code they cover in `__tests__/` directories,
currently `scripts/build/__tests__/` and `scripts/wildcard-domain-processor/__tests__/`.

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
1. Update tests in the matching `__tests__/` directory for the code you changed
   (`scripts/build/__tests__/`, `scripts/wildcard-domain-processor/__tests__/`).
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
