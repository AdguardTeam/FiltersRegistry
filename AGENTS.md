# AGENTS.md — AdGuard Filters Registry

## Project Overview

AdGuard Filters Registry is the canonical repository of filter list
subscriptions available to AdGuard users. It stores AdGuard's own filters
and re-hosted third-party filter lists (served via `filters.adtidy.org`).

The build pipeline compiles filter templates into platform-specific outputs,
generates patches (diffs), and produces localized metadata
for all supported AdGuard products.

## Technical Context

- **Language / Version**: TypeScript and JavaScript, Node.js >= 22, ESM (`"type": "module"`).
  New code must be written in TypeScript. The project is gradually migrating all scripts to
  TypeScript; existing `.js` files should be converted to `.ts` when touched.
- **Primary Dependencies**:
    - `@adguard/filters-compiler` — compiles filter templates into final filter lists
    - `@adguard/agtree` — AdGuard filter rule parser / AST
    - `@adguard/diff-builder` — generates incremental patches between filter versions
    - `@adguard/dead-domains-linter` — detects rules targeting dead domains
    - `zod` — schema validation
    - `crypto-js` — checksum computation
- **Storage**: File-system based; no database
- **Testing**: Vitest (unit + integration + e2e tests under `scripts/*/__tests__/`)
- **Target Platform**: Node.js CLI tooling; build outputs target 8 top-level AdGuard product
  platforms (Android, CLI, Extension, iOS, Mac, Mac v2, Mac v3, Windows).
  The Extension platform has 9 sub-targets: Chromium, Chromium MV3, Edge, Firefox, Opera,
  Opera MV3, Safari, Android Content Blocker, uBlock.
- **Project Type**: Single repository (build tooling + data)
- **CI**: Three GitHub Actions workflows — `build-adguard.yaml`, `build-3p.yaml`, and
  `test.yaml` (runs `yarn test` on every pull request)
- **Performance Goals**: N/A
- **Constraints**: Filter lists must remain compatible with AdGuard's rule syntax;
  third-party filters follow an acceptance policy documented in README.md
- **Scale / Scope**: dozens of AdGuard filters, dozens of third-party filters, multiple platform targets,
  many locale translations

## Project Structure

```text
├── filters/                        # Filter list sources
│   ├── filter_<ID>_<Name>/         # AdGuard filters (dozens of dirs) — each contains template.txt,
│   │                               #   metadata.json, revision.json, filter.txt, diff.txt
│   ├── ThirdParty/                 # Third-party filters (dozens of dirs, same structure)
│   └── exclusions.txt              # Global rule exclusions
├── platforms/                      # Built platform-specific outputs (multiple top-level platforms)
│   └── <platform>/                 # android, cli, extension, ios, mac, mac_v2, mac_v3, windows
│       ├── filters/                # Compiled filter files per platform
│       ├── patches/                # Incremental diff patches
│       ├── filters.json            # Filter metadata for the platform
│       ├── filters_i18n.json       # Localized filter metadata
│       └── <sub-target>/           # extension/ only: chromium, chromium-mv3, edge, firefox,
│                                   #   opera, opera-mv3, safari, android-content-blocker, ublock
├── scripts/                        # All build and utility scripts
│   ├── build/                      # build.js, build-config.ts, constants.js,
│   │                               #   custom_platforms.js, patches.js, strip-generated-meta.ts
│   ├── checksum/                   # Checksum generation (index.ts)
│   ├── repository/                 # compress.js — repository compression
│   ├── translations/               # Locale download/upload tooling
│   ├── utils/                      # Shared utilities (find_files.js, splitter.ts, strings.js)
│   ├── validation/                 # validate_platforms.js, validate_locales.js
│   ├── wildcard-domain-processor/  # TS module with CLI, unit tests (__tests__/)
│   └── auto_build.sh               # Automated build entry point
├── locales/                        # Translations (45+ language dirs)
├── groups/                         # Filter group definitions (metadata.json)
├── tags/                           # Filter tag taxonomy (metadata.json)
├── temp/                           # Temporary build artifacts
├── package.json                    # Project manifest and scripts
├── tsconfig.json                   # TypeScript config (ES2022, nodenext)
├── vitest.config.ts                # Test runner config
├── optimization_config.json        # Per-filter optimization parameters
├── .eslintrc.cjs                   # ESLint config (airbnb-typescript)
├── .markdownlint.json              # Markdownlint config
└── README.md                       # Project documentation
```

## Build And Test Commands

| Command | Description |
| ------- | ----------- |
| `yarn build` | Build all filters (`tsx scripts/build/build.js`) |
| `yarn build:local` | Build from cached `filter.txt` (`build.js --use-cache`) |
| `yarn auto-build` | Full automated build via `bash scripts/auto_build.sh` |
| `yarn build:patches` | Build incremental patches |
| `yarn generate-cache` | Generate cached `filter.txt` from templates (`tsx scripts/build/build.js --generate-cache`) |
| `yarn download-stats` | Download per-filter `stats.json` to `temp/optimization/stats/` |
| `yarn strip-generated-meta` | Strip meta lines from `.txt` files + `version`/`timeUpdated` from `filters.{json,js}` |
| `yarn test` | Run unit tests (`vitest run`) |
| `yarn lint` | Run all linters (code + types + markdown) |
| `yarn lint:code` | ESLint check (`eslint . --ext .js,.ts`) |
| `yarn lint:types` | TypeScript type check (`tsc --noEmit`) |
| `yarn lint:md` | Markdown lint (`markdownlint **/*.md`) |
| `yarn validate` | Validate platforms and locales |
| `yarn validate:platforms` | Validate platform build outputs |
| `yarn validate:locales` | Validate locale files |
| `yarn compare-build-output` | Build comparison vs. master. Requires interactive manual inputs; not for CI/automation |
| `yarn update-wildcard-domains` | Scan filters for wildcard domains |
| `yarn expand-wildcard-domains` | Expand wildcard domains in platform builds |
| `yarn compress` | Compress repository data |

`yarn build:local` reuses `temp/optimization/stats/` when present and otherwise fetches stats from the remote server.

`yarn download-stats` stages fetches in a temp directory and swaps in the whole stats directory
only after every fetch succeeds. `--include` / `--skip` scope which filters are fetched,
so a scoped `yarn download-stats` drops every other filter's cached stats; `--report`,
`--strip-generated-meta`, and `--no-patches-prepare` error when combined with it.

See [DEVELOPMENT.md — Command Compatibility](DEVELOPMENT.md#command-compatibility)
for which flag combinations are allowed.

## Contribution Instructions

After completing any task that modifies code in `scripts/`:

1. **Run the linter.** Fix all errors before committing.

    ```bash
    yarn lint
    ```

    > **Important:** `yarn lint` runs three checks sequentially:
    > `yarn lint:code` → `yarn lint:types` → `yarn lint:md`.
    > A failure in any one stage aborts the rest. Always verify that **all three**
    > pass, including Markdown lint on edited `.md` files.

2. **Run unit tests.** All tests must pass.

    ```bash
    yarn test
    ```

3. **Update tests for changed code.** Add or update tests in the `__tests__/` directory
   alongside the code you changed:
   - `scripts/wildcard-domain-processor/__tests__/` for wildcard-domain-processor changes
   - `scripts/build/__tests__/` for build script changes

4. **Validate platform outputs** if filters, templates, or build scripts changed.

    ```bash
    yarn validate
    ```

5. **Verify Code Guidelines compliance.** Review your changes against the Code Guidelines section below.

6. **Do not modify generated files by hand.** Files in `platforms/`, `filter.txt`, `diff.txt`,
   and `revision.json` inside filter directories are generated by the build pipeline.

7. **Do not modify third-party filter sources.** Files under `filters/ThirdParty/` are managed
   by the upstream filter lists workflow and should not be edited manually.

8. **Synchronise code, tests, and documentation for CLI changes.** When adding or modifying
   command-line arguments, build flags, or their compatibility rules:
    - Add or update tests in `scripts/build/__tests__/` covering the new behaviour.
    - Update the *Command Compatibility* section in `DEVELOPMENT.md`.
    - Never merge CLI changes without matching tests and documentation.

## Code Guidelines

### Architecture

- **Scripts** live under `scripts/` and are organized by function:
  `build/`, `checksum/`, `repository/`, `translations/`, `utils/`, `validation/`,
  `wildcard-domain-processor/`.
- **Filter data** is stored under `filters/` — one directory per filter with a consistent
  structure (`template.txt`, `metadata.json`, `revision.json`, `filter.txt`, `diff.txt`).
- **Platform outputs** in `platforms/` are generated artifacts, not source files.
- The project uses ESM (`"type": "module"` in package.json); use `import`/`export`, not `require`.

### Code Quality

General code style guidelines for JavaScript are available via link:
<https://github.com/AdguardTeam/CodeGuidelines/blob/master/JavaScript/Javascript.md>.

- **TypeScript**: Strict mode enabled (`strict: true` in tsconfig). Use proper types; avoid `any`.
- **Markdown**: Follow `.markdownlint.json` — dash-style unordered lists, asterisk emphasis,
  120-char line limit.
- All other style rules (indentation, line length, Airbnb conventions, etc.)
  are enforced by `.eslintrc.cjs`. Run `yarn lint` to check.

### Testing

- Test framework: Vitest.
- Tests live alongside the code they cover in `__tests__/` directories.
- Test files use the `.test.ts` extension.
- Test fixtures go in `__tests__/resources/`.

### Other

- **Node.js version**: >= 22. Do not use APIs unavailable in Node 22.
- **Script execution**: Use `tsx` to run TypeScript scripts directly (do not pre-compile).
- **Filter syntax**: AdGuard-specific rule syntax.
  Refer to [AdGuard knowledge base] for rule format documentation.

[AdGuard knowledge base]: https://adguard.com/kb/general/ad-filtering/create-own-filters
