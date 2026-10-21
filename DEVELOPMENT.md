# Development Guide

## Prerequisites

- **Node.js** >= 24
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
  files in `platforms/` and `temp/platforms/`, and remove the `version`/`timeUpdated`
  fields from every entry in `filters.json`/`filters.js`. Useful when comparing outputs between builds.

### Stripping Generated Metadata

`--strip-generated-meta` runs this pass as part of a build. To run the same pass
on an existing build-output directory without recompiling, use the standalone
command:

```bash
yarn strip-generated-meta <dir>
```

It rewrites, in place, every `.txt` filter file and every `filters.json` /
`filters.js` under `<dir>` — dropping the generated meta lines and the
`version` / `timeUpdated` fields, exactly as the build flag does.

The directory argument is **required**. The command mutates files in place, and
defaulting to the tracked `platforms/` tree would make it easy to strip the
committed metadata the products read. Point it at a throwaway copy instead:

```bash
yarn strip-generated-meta temp/platforms
```

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

Optimization stats are picked up automatically: `yarn download-stats` records
the `--include`/`--skip` selection it was run with in a sibling
`temp/optimization/stats.scope` marker. A build reuses `temp/optimization/stats`
only when that marker matches its own selection — or was a full, unscoped
download, which covers any selection. A mismatched or missing marker doesn't
fail the build; it just falls back to fetching stats from the remote server,
with a log message explaining why.
If a filter's `stats.json` is missing under a cache that *did* match, the
build fails with a message pointing at `yarn download-stats`.

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

It walks through a few prompts, in order:

1. The branch to compare (defaulting to the current branch; `master` itself
  is never offered as a choice).
2. An optional filter-ID selection (`--include` / `--skip`, forwarded to
  every build command so a quick check can build a handful of filters).
3. The build mode — a plain `build`, or `build:local` from cached sources.
  Choosing cached mode adds two follow-up prompts: whether to run
  `generate-cache` first, and whether to use optimization stats. Stats are
  cached-mode only (`build.js` only applies a local stats cache under
  `--use-cache`); when used, they're downloaded once into a shared
  `temp/reg-stats` (kept separate from the main checkout's
  `temp/optimization/stats`) and copied into both worktrees, so both builds
  see the same snapshot instead of each fetching its own.
4. Whether to remove the build artifacts when finished.

Under the hood it builds `master` and the compare branch
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
  instead of removing and re-adding it. `yarn install` still runs, but over
  the kept `node_modules` it only reconciles what changed.
- If `temp/reg-stats` already holds a snapshot downloaded under the same
  filter selection (tracked via a sibling `temp/reg-stats.scope`, copied
  alongside the snapshot into both worktrees), it offers to reuse it instead
  of running `download-stats` again; a different selection forces a refresh.

### Command Compatibility

The following flags can be used with `yarn build` and `yarn build:local`:

- `-i=`, `--include=` — comma- or whitespace-separated filter IDs to build
  (e.g., `--include=1,2,3` or `--include="1 2 3"`)
- `-s=`, `--skip=` — comma- or whitespace-separated filter IDs to exclude
  (e.g., `--skip=12,24` or `--skip="12 24"`). Can be combined with
  `--include`: a filter is built only if it's in `--include` and not in `--skip`.

  Quote whitespace-separated values so shells pass them as one argument. This
  format also handles commas converted to spaces by PowerShell `.cmd` shims.
- `--report=` — custom report file name (e.g., `--report='report-adguard.txt'`)
- `--no-patches-prepare` — skip copying `platforms/` to `temp/platforms/`
- `--strip-generated-meta` — remove generated meta lines from `.txt` files and
  `version`/`timeUpdated` from `filters.json`/`filters.js`
  (see [Stripping Generated Metadata](#stripping-generated-metadata))
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

#### ESLint configuration

`eslint.config.js` is a native flat config with no dependency on `eslint-config-airbnb-base` or
`eslint-config-airbnb-typescript`. Those packages cannot run on ESLint 10: `airbnb-typescript` is pinned to
`@typescript-eslint` v7, whose `LegacyESLint` class ESLint 10 removed, and `eslint-plugin-import` (which
`airbnb-base` depends on) calls a `SourceCode` method ESLint 10 also removed.

Rather than replace the project's rule set, it was ported: the rules were captured from the project's own
effective configuration under ESLint 8 (`airbnb-base` 15.0.0 + `airbnb-typescript` 18.0.0 plus every
project-specific override the former `.eslintrc.cjs` carried) and written directly into `eslint.config.js`. This
was a one-time migration step, verified with a one-off config-and-lint comparison; the file is self-contained
and is not regenerated from the airbnb packages at lint time or in CI.

A few rule ids changed on the way in, with no change in behaviour:

- Formatting rules that `@typescript-eslint` v7 shipped and v8 dropped (`brace-style`, `comma-dangle`,
  `comma-spacing`, `func-call-spacing`, `indent`, `keyword-spacing`, `lines-between-class-members`,
  `no-extra-parens`, `no-extra-semi`, `object-curly-spacing`, `quotes`, `semi`, `space-before-blocks`,
  `space-before-function-paren`, `space-infix-ops`) now live under `@stylistic/*`.
- `@typescript-eslint/no-throw-literal` is now `@typescript-eslint/only-throw-error`.
- `import/*` is now `import-x/*`, since `eslint-plugin-import-x` is the maintained fork used in place of
  `eslint-plugin-import`.

Two known, intentional differences from the old ESLint 8 configuration:

- `import-x/no-cycle`'s `disableScc` option no longer exists in the current rule's schema, so that one key was
  dropped from its options; the rest of the rule's configuration (`maxDepth`, `ignoreExternal`, etc.) is
  unchanged.
- A handful of rules gained additional options with their own defaults in newer plugin releases (for example
  `no-shadow-restricted-names` now also reports `globalThis` by default). These are additive; nothing that was
  previously enabled was turned off or loosened.

Rule ids and options are otherwise identical to the pre-migration configuration. There is no automated check
enforcing this going forward — treat any future ESLint or plugin upgrade as a normal config change, and update
this section if a rule's behaviour needs to diverge from what is documented here.

### Testing

Run unit tests:

```bash
yarn test
```

Tests use Vitest and live alongside the code they cover in `__tests__/` directories,
currently `scripts/build/__tests__/`, `scripts/repository/__tests__/`,
`scripts/translations/__tests__/`, and `scripts/wildcard-domain-processor/__tests__/`.

The repository compression tests drive the real `git filter-repo` 2.47 or newer and are skipped
when the tool is not installed. The compression procedure needs the tool on the operator machine.
The `Compression tests` workflow runs them in a container image that provides the tool: on every
pull request that touches `scripts/repository/`, and on a monthly schedule, so a new
`git-filter-repo` release is caught before the annual window.

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

`yarn validate:platforms` also simulates a client patch update: for every filter file changed relative
to git HEAD on a patch-enabled platform, it applies the patch named by the committed `! Diff-Path` and
requires the result to match the built file. Files without a committed `! Diff-Path`, new filters, and
filters whose patch target is absent (the full-download transition) are skipped. This requires a git
checkout with a valid `HEAD`.

### Repository Compression

Once a year, we compress the repository to reduce its size.
The compression script rewrites `master` into a history that holds the initial commit,
one squash commit, and the last `commits_to_keep` commits (default `1000`, about a month
of history) with their merge structure. The file tree of `master` is unchanged. The storage
scheme stays the same: `platforms/` and the generated files remain in Git.

#### How to

##### 1. Prepare a full clone and a backup copy

```bash
git clone <repository-url>
git clone --mirror <repository-url> backup.git
# or, to extend an existing shallow clone:
git fetch --unshallow
```

Keep the backup copy until the next build succeeds and the team has re-cloned.

##### 2. Install the dependencies and `git-filter-repo`

```bash
yarn install
brew install git-filter-repo
# or
pipx install git-filter-repo
```

`git-filter-repo` 2.47 or newer is required. The script verifies the version and stops
if the tool is missing or older.

##### 3. Record the current `master` head

This hash is the rollback anchor:

```bash
git rev-parse master
```

##### 4. Rehearse on a copy

Run `yarn compress 1000` on a copy of the full clone and run the validation commands
from step 10.

##### 5. Announce the window and close the open pull requests

Announce the window to the team. Close the open pull requests:

```bash
gh pr close <number> --comment "rebase and reopen after the compression"
```

##### 6. Disable the write workflows and drain the active runs

```bash
gh workflow disable build-adguard.yaml
gh workflow disable build-3p.yaml
gh workflow disable update-translations.yaml
gh run list --status queued
gh run list --status in_progress
```

Wait until both lists are empty.

##### 7. Disable the branch protection ruleset

Disable the ruleset that blocks force pushes and deletion of the `master` branch.

##### 8. Delete every branch except `master`

List the remote branches, then delete each branch except `master`:

```bash
git ls-remote --heads origin
git push origin --delete <branch>
```

##### 9. Rewrite the local history

```bash
git fetch origin
# the script rewrites the local master, so move it to the remote head first
git reset --hard origin/master
yarn compress 1000
```

The script prints the old head and the new head.

##### 10. Validate the rewritten history

With the old head hash printed by the script:

- `git diff <old head> master` is empty;
- `git rev-list --count --first-parent master` equals `commits_to_keep + 2`;
- `git log --oneline --first-parent | tail -2` shows the squash commit above the
  initial commit;
- the merge commits are still present;
- `git for-each-ref refs/replace` is empty.

##### 11. Overwrite the `master` branch

```bash
git push --force-with-lease=master:<old head> origin master
```

The lease rejects the push if `master` moves after the fetch in step 9, instead of
dropping those commits.

##### 12. Restore the ruleset and the workflows

Re-enable the branch protection ruleset and the write workflows:

```bash
gh workflow enable build-adguard.yaml
gh workflow enable build-3p.yaml
gh workflow enable update-translations.yaml
```

##### 13. Run one build

Confirm that the build succeeds and pushes a commit:

```bash
gh workflow run build-adguard.yaml
```

#### If the validation fails

Stop before the push. The script runs `git filter-repo` with `--refs master`, which
keeps the pre-rewrite objects, so you can restore the old history:

```bash
git reset --hard <old head>
```

If the old head is unavailable, restore from the backup copy. If the push is rejected,
the ruleset that blocks force pushes is still active: disable it and push again.

#### After the window

Send the team instruction:

- re-clone, or run `git fetch origin && git reset --hard origin/master`;
- never run `git pull` from an old clone;
- rebase branches before pushing.

Pull-request authors rebase onto the new `master` and reopen their pull requests. An old
branch shares only the initial commit with the new `master`, so a plain `git rebase
origin/master` replays the whole squashed history. Save the old base before the fetch and
rebase onto it:

```bash
old_base=$(git merge-base <branch> origin/master)   # before fetching the rewritten master
git fetch origin
git rebase --onto origin/master "$old_base" <branch>
```

GitHub keeps `refs/pull/*/head` for every closed pull request, so the size GitHub reports
may not drop after the rewrite. New clones are smaller because they do not fetch
pull-request refs. Keep the backup copy until the next build succeeds and the team has
re-cloned. Optionally reclaim local disk:

```bash
git reflog expire --expire=now --all && git gc --prune=now
```

## Common Tasks

### Adding or Editing an AdGuard Filter

1. Edit the `template.txt` in the filter's directory,
   e.g., `filters/filter_2_Base/template.txt`.
1. Update `metadata.json` if filter metadata changed.
1. Build to regenerate platform outputs: `yarn build --include=<filterID>`.
1. Validate: `yarn validate`.

### Adding a New Filter

Registering a brand-new filter (new `filterId`) takes more than creating
`filters/filter_<ID>_<Name>/`: downstream products must be ready for the new ID
*before* the filter is compiled into their platform outputs.

1. Create the filter directory (`template.txt`, `metadata.json` with a unique
   `filterId`, `timeAdded`, `groupId`, tags, etc.). Register new tags or groups
   in `tags/metadata.json` / `groups/metadata.json` if needed.
1. **Check MV3 browser extension readiness.** The MV3 browser extension
   (Chromium MV3, Edge MV3, Opera MV3) reads the platform `filters.json`
   metadata, but its bundled DNR rulesets come from the `@adguard/dnr-rulesets`
   package (ext-tsurlfilter monorepo), and only the ruleset IDs allowlisted in
   its `tasks/validator-data.json` are included. If a new filter reaches the
   `ext_chromium_mv3` / `ext_edge_mv3` / `ext_opera_mv3` outputs before the
   extension ships the matching bundled ruleset, it appears in the extension UI
   but cannot be enabled (`RulesetCounter for filterId <ID> not found`) — this
   happened with filters 26 and 27, see
   [#1260](https://github.com/AdguardTeam/FiltersRegistry/pull/1260).

   The extension is *ready* for a new filter only when **both** are true:
    - `@adguard/dnr-rulesets` includes the new ruleset — `validator-data.json`
      and related files are updated per the "Managing `validator-data.json`"
      guide in the dnr-rulesets README, and
    - an MV3 extension release bundling the updated rulesets has shipped.
      Manifest `rule_resources` changes require a full store review, so this
      cannot ride an auto-publish.

   Until then, exclude the filter from the MV3 platforms in its `metadata.json`:

    ```json
    "platformsExcluded": [
        "ext_chromium_mv3",
        "ext_edge_mv3",
        "ext_opera_mv3"
    ]
    ```

   Remove the exclusion only *after* that extension release has shipped;
   removing it earlier brings the phantom entries back.
1. Build to regenerate platform outputs: `yarn build --include=<filterID>`.
1. Validate: `yarn validate`.

### Working with Translations

Translations live in `locales/` (45+ languages). See
[scripts/translations/README.md](scripts/translations/README.md) for the full workflow:

1. Download latest translations: `cd scripts/translations && CROWDIN_FILTERS_REGISTRY_TOKEN=... ./download-crowdin.sh`
1. Validate: `yarn validate:locales`
1. Edit strings in `locales/` as needed.
1. Upload changes (manual only): `cd scripts/translations && ./upload.sh`

Translations are stored in the Crowdin project `adguard-applications` (project ID 365951) under
`miscellaneous/filters-registry`; downloads use the Crowdin CLI configured in the root
`crowdin.yml`. The legacy Twosky-based `download.sh`/`upload.sh` scripts are kept for reference;
uploading strings to the service is done manually via `upload.sh` only — there is no
Crowdin-CLI-based upload script.

The first two steps are automated: the `update-translations.yaml` workflow downloads
translations via `download-crowdin.sh` (authenticated with the
`CROWDIN_FILTERS_REGISTRY_TOKEN` repository secret), validates them with
`yarn validate:locales`, and opens a pull request with the changes to `locales/`.
Merging is manual; the next regular build propagates new strings into `platforms/`.

The workflow runs every Monday at 06:00 UTC and on manual dispatch. It adds the default
reviewers to the translations PR.

The auto-created PR is opened with the default `GITHUB_TOKEN`, so GitHub does not run
`test.yaml`/`build-adguard` on it (events raised with that token do not start workflow
runs). The update job itself runs `yarn validate:locales`, `yarn lint`, and `yarn test`
and fails the job — triggering the Slack notification — when any of them fail; these
checks are the only gate for the translations PR.

### Modifying Build Scripts

All build tooling lives under `scripts/`. After making changes:

1. Run `yarn lint` — fix all errors.
1. Run `yarn test` — all tests must pass.
1. Update tests in the matching `__tests__/` directory for the code you changed
   (`scripts/build/__tests__/`, `scripts/repository/__tests__/`,
   `scripts/translations/__tests__/`, `scripts/wildcard-domain-processor/__tests__/`).
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
