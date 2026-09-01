#!/bin/bash

# Compare build output: build master and a compare branch in parallel git worktrees,
# then diff their compiled platform output. See "Typical workflow — comparing
# build results against master" in DEVELOPMENT.md.
#
# Usage: yarn compare-build-output

BASE_BRANCH="master"
BUILD_FLAGS="--no-patches-prepare --strip-generated-meta"

# Without this, a missing yarn only surfaces minutes later as an install/build
# log failure instead of failing fast up front.
command -v yarn >/dev/null 2>&1 || { echo "Error: yarn not found on PATH." >&2; exit 1; }

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT" || exit 1
GIT_COMMON_DIR=$(git rev-parse --git-common-dir)

TEMP_DIR_NAME="$REPO_ROOT/temp"
mkdir -p "$TEMP_DIR_NAME"

# Guards against two concurrent runs corrupting the shared worktrees/logs.
# Lives under TMPDIR, outside the build tree.
LOCK_KEY=$(printf '%s' "$REPO_ROOT" | cksum | cut -d' ' -f1)
LOCK_DIR="${TMPDIR:-/tmp}/compare-build-output-$(basename "$REPO_ROOT")-$LOCK_KEY.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "Error: another compare-build-output run appears to be in progress (lock: $LOCK_DIR)." >&2
    echo "If you're sure none is running, remove that directory and retry." >&2
    exit 1
fi
trap 'rm -rf "$LOCK_DIR"' EXIT

MASTER_WORK_TREE="$TEMP_DIR_NAME/reg-${BASE_BRANCH}-build"
CHANGED_WORK_TREE="$TEMP_DIR_NAME/reg-changed-build"
META_FILE="$TEMP_DIR_NAME/reg-meta.env"
PLATFORMS_MASTER="$TEMP_DIR_NAME/platforms_${BASE_BRANCH}_build"
PLATFORMS_CHANGED="$TEMP_DIR_NAME/platforms_changed_build"

LOG_DIR_NAME="logs"
mkdir -p "$TEMP_DIR_NAME/$LOG_DIR_NAME"

LOG_MASTER_INSTALL="$TEMP_DIR_NAME/$LOG_DIR_NAME/${BASE_BRANCH}-install.log"
LOG_CHANGED_INSTALL="$TEMP_DIR_NAME/$LOG_DIR_NAME/changed-install.log"
LOG_MASTER_BUILD="$TEMP_DIR_NAME/$LOG_DIR_NAME/${BASE_BRANCH}-build.log"
LOG_CHANGED_BUILD="$TEMP_DIR_NAME/$LOG_DIR_NAME/changed-build.log"
LOG_SYNC_BASELINE="$TEMP_DIR_NAME/$LOG_DIR_NAME/sync-baseline.log"
LOG_COPY_MASTER="$TEMP_DIR_NAME/$LOG_DIR_NAME/copy-${BASE_BRANCH}.log"
LOG_COPY_CHANGED="$TEMP_DIR_NAME/$LOG_DIR_NAME/copy-changed.log"
LOG_WIPE_PLATFORMS="$TEMP_DIR_NAME/$LOG_DIR_NAME/wipe-platforms.log"
LOG_RESTORE_PLATFORMS="$TEMP_DIR_NAME/$LOG_DIR_NAME/restore-platforms.log"
LOG_CLEANUP="$TEMP_DIR_NAME/$LOG_DIR_NAME/cleanup.log"

# Colors and symbols used throughout, disabled when not attached to a terminal.
if [ -t 1 ]; then
    C_CYAN=$'\033[1;36m'
    C_DIM=$'\033[2m'
    C_BOLD=$'\033[1m'
    C_GREEN=$'\033[1;32m'
    C_RED=$'\033[1;31m'
    C_RESET=$'\033[0m'
else
    C_CYAN=""
    C_DIM=""
    C_BOLD=""
    C_GREEN=""
    C_RED=""
    C_RESET=""
fi
ARROW="→"
CHECK="✓"
CROSS="✗"
TOTAL_STEPS=10

# Prints a blank line and a bold "Step N/10: <title>" header.
step_header() {
    echo ""
    echo "${C_BOLD}Step $1/$TOTAL_STEPS: $2${C_RESET}"
}

# Prompts "[Y/N] (default: Y/N): " and reports whether the answer was yes.
# Pass "default_no" to flip the default to No (still returns success only on
# an explicit y/yes answer, never on the defaulted Enter).
confirm() {
    local mode=${1:-default_yes}
    local reply
    if [ "$mode" = default_no ]; then
        read -r -p "[Y/N] (default: N): " reply
        reply=${reply:-N}
    else
        read -r -p "[Y/N] (default: Y): " reply
        reply=${reply:-Y}
    fi
    [[ "$reply" =~ ^[Yy] ]]
}

# Renders a single status line for one or more "pid:label" pairs until all
# processes finish. Callers still need to `wait "$pid"` afterwards for exit codes.
spinner_wait_all() {
    local frames='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0
    local all_done=0
    while [ "$all_done" -eq 0 ]; do
        i=$(( (i + 1) % ${#frames} ))
        local frame="${frames:$i:1}"
        local line=""
        all_done=1
        for pair in "$@"; do
            local pid="${pair%%:*}"
            local label="${pair#*:}"
            if kill -0 "$pid" 2>/dev/null; then
                line+="${C_CYAN}${frame}${C_RESET} $label   "
                all_done=0
            else
                line+="${C_GREEN}${CHECK}${C_RESET} $label   "
            fi
        done
        printf "\r%s" "$line"
        sleep 0.1
    done
    printf "\n"
}

# Runs a single command in the background with a spinner, output redirected
# to a log file so it doesn't clobber the spinner line. Returns the command's
# exit code.
run_with_spinner() {
    local label=$1
    local log=$2
    shift 2
    "$@" > "$log" 2>&1 &
    local pid=$!
    spinner_wait_all "$pid:$label"
    wait "$pid"
}

# Prints a failure line with the log path, plus the log's full content so the
# actual error is visible without having to go open the file separately.
report_failure() {
    local message=$1
    local log=$2
    echo "${C_RED}${CROSS}${C_RESET} $message — see $log" >&2
    if [ -s "$log" ]; then
        echo "${C_DIM}--- $log ---${C_RESET}" >&2
        cat "$log" >&2
        echo "${C_DIM}--- end ---${C_RESET}" >&2
    fi
}

# report_failure, then exit 1. For the steps where a failure can't be
# recovered from and must stop the script immediately.
die() {
    report_failure "$1" "$2"
    exit 1
}

# The yarn subcommands a build runs, in order, one per line. Single source of
# truth for both the real build (Step 8) and the report's "Build command"
# line, so the two can't drift. Reads BUILD_MODE / DO_GENERATE_CACHE /
# DO_GENERATE_STATS.
build_subcommands() {
    if [ "${BUILD_MODE:-plain}" != "cached" ]; then
        echo "build $BUILD_FLAGS"
        return
    fi
    [ "${DO_GENERATE_CACHE:-false}" = "true" ] && echo "generate-cache"
    [ "${DO_GENERATE_STATS:-false}" = "true" ] && echo "download-stats"
    echo "build:local $BUILD_FLAGS"
}

# Given a ref and the SHA a previous run recorded for it, returns a dim
# "(now at <short>)" fragment when the ref has moved on since — appended to
# that branch's line in the reuse prompt to show the kept output is stale.
# Empty when the SHA still matches, or the ref no longer resolves.
sha_drift_note() {
    local ref=$1 recorded=$2 current
    current=$(git rev-parse --verify --quiet "$ref" 2>/dev/null) || return 0
    [ "$current" = "$recorded" ] && return 0
    printf '%s' "  ${C_DIM}(now at ${current:0:9})${C_RESET}"
}

# Echoes the -i=/-s= flags for the current INCLUDED_FILTER_IDS /
# EXCLUDED_FILTER_IDS selection, or nothing when neither is set. Passed
# unquoted so it word-splits into separate args (or vanishes when empty).
filter_flags() {
    local flags=""
    [ -n "$INCLUDED_FILTER_IDS" ] && flags="-i=$INCLUDED_FILTER_IDS"
    [ -n "$EXCLUDED_FILTER_IDS" ] && flags="$flags${flags:+ }-s=$EXCLUDED_FILTER_IDS"
    printf '%s' "$flags"
}

# True when a copied platforms dir actually holds built filter files, not an
# empty tree left by a previous run that died mid-build (which would otherwise
# get reused and reported as PASS against another empty tree).
has_built_output() {
    [ -n "$(find "$1" -name '*.txt' ! -name '*.patch' -print -quit 2>/dev/null)" ]
}

# Loads the meta file written by Step 8 into its known variables. Parses
# rather than `source`s it: CHANGED_BRANCH is a git refname and may legally
# contain $(...) or backticks, which `source` would execute.
load_meta() {
    local _key _val
    while IFS='=' read -r _key _val || [ -n "$_key" ]; do
        case "$_key" in
            MASTER_SHA|CHANGED_SHA|CHANGED_BRANCH|BUILD_MODE|DO_GENERATE_CACHE|DO_GENERATE_STATS|INCLUDED_FILTER_IDS|EXCLUDED_FILTER_IDS)
                printf -v "$_key" '%s' "$_val"
                ;;
        esac
    done < "$1"
}

# Restores a worktree's platforms/ to its checked-out state, undoing the
# Step 8 wipe and whatever the build wrote into it.
restore_worktree_platforms() {
    git -C "$1" checkout --quiet -- platforms/ &&
        git -C "$1" clean --quiet -fd -- platforms/
}

# Waits on one branch's build, copies its platforms/ output into the
# comparison directory, then restores the worktree's platforms/
# Step 8 wipes it before building, and the built output is captured in $dest.
# Sets BUILD_FAILED=true on any failure.
# Args: label  pid  build_log  worktree  dest  copy_log
collect_build() {
    local label=$1 pid=$2 build_log=$3 worktree=$4 dest=$5 copy_log=$6 rc=0
    if wait "$pid"; then

        # Delete the existing $dest directory first,
        # to prevent cp -r from merging files and leaving stale data in the diff.
        rm -rf "$dest"

        if run_with_spinner "[$label] copying platforms/ output" "$copy_log" \
            cp -r "$worktree/platforms" "$dest"; then
            echo "${C_GREEN}${CHECK}${C_RESET} [$label] build done"
        else
            report_failure "[$label] copying platforms/ output FAILED" "$copy_log"
            rc=1
        fi
    else
        report_failure "[$label] build FAILED" "$build_log"
        rc=1
    fi
    if ! run_with_spinner "[$label] restoring worktree platforms/" "$LOG_RESTORE_PLATFORMS" \
        restore_worktree_platforms "$worktree"; then
        die "[$label] restoring worktree platforms/ FAILED" "$LOG_RESTORE_PLATFORMS"
    fi
    [ "$rc" -eq 0 ] || BUILD_FAILED=true
    return "$rc"
}

# Removes the worktrees, the copied platforms output and the meta file.
cleanup_all() {
    git worktree remove "$MASTER_WORK_TREE" -f 2>/dev/null || rm -rf "$MASTER_WORK_TREE"
    git worktree remove "$CHANGED_WORK_TREE" -f 2>/dev/null || rm -rf "$CHANGED_WORK_TREE"
    rm -rf "$PLATFORMS_MASTER" "$PLATFORMS_CHANGED"
    rm -f "$META_FILE"
}

# Honors DO_CLEANUP: either runs cleanup_all or prints what was kept and
# where. Called from Step 10 and from the build-failure path, so a failed run
# also respects the cleanup choice instead of always leaving state behind.
run_cleanup() {
    if [ "$DO_CLEANUP" = true ]; then
        if run_with_spinner "cleaning up worktrees and build output" "$LOG_CLEANUP" cleanup_all; then
            rm -f "$LOG_CLEANUP"
        else
            report_failure "cleanup FAILED" "$LOG_CLEANUP"
        fi
    else
        echo "${C_CYAN}${ARROW}${C_RESET} Cleanup skipped. Kept:"
        echo "  $MASTER_WORK_TREE"
        echo "  $CHANGED_WORK_TREE"
        echo "  $PLATFORMS_MASTER"
        echo "  $PLATFORMS_CHANGED"
        echo "  logs in $TEMP_DIR_NAME/$LOG_DIR_NAME"
    fi
}

# The existing pass/fail comparison report. Reads MASTER_SHA / CHANGED_SHA /
# CHANGED_BRANCH / BUILD_MODE / INCLUDED_FILTER_IDS / EXCLUDED_FILTER_IDS and
# the platforms_{master,changed}_build/ dirs.
generate_report() {
    local build_cmd build_sub filter_args total rule_diffs diff_list meta_diffs
    local master_file rel changed_file changed_only_file

    echo "${C_BOLD}=== Regression Test Report ===${C_RESET}"
    echo "Branch (reference): $BASE_BRANCH          @ $MASTER_SHA"
    echo "Branch (changed):   $CHANGED_BRANCH @ $CHANGED_SHA"
    build_cmd=""
    while IFS= read -r build_sub; do
        build_cmd+="${build_cmd:+ && }yarn $build_sub"
    done < <(build_subcommands)
    filter_args=$(filter_flags)
    echo "Build command:      $build_cmd${filter_args:+ $filter_args}"
    echo "Platforms compared: $(ls "$PLATFORMS_MASTER" | tr '\n' ' ')"
    echo ""

    # Total .txt files
    total=$(find "$PLATFORMS_MASTER" -name "*.txt" ! -name "*.patch" | wc -l | tr -d ' ')

    # Primary check — rule files
    rule_diffs=0
    diff_list=""

    while IFS= read -r -d '' master_file; do
        rel="${master_file#"$PLATFORMS_MASTER"/}"
        changed_file="$PLATFORMS_CHANGED/${rel}"
        if [ -f "$changed_file" ]; then
            if ! diff -q "$master_file" "$changed_file" > /dev/null 2>&1; then
                diff_list="$diff_list\n  DIFF: $rel"
                rule_diffs=$((rule_diffs + 1))
            fi
        else
            diff_list="$diff_list\n  MISSING: $rel"
            rule_diffs=$((rule_diffs + 1))
        fi
    done < <(find "$PLATFORMS_MASTER" -name "*.txt" ! -name "*.patch" -print0)

    # Reverse check — files that exist only on the compare branch's side.
    # The loop above only walks $PLATFORMS_MASTER, so a file added purely by
    # the compare branch would otherwise never surface in the report at all.
    while IFS= read -r -d '' changed_only_file; do
        rel="${changed_only_file#"$PLATFORMS_CHANGED"/}"
        master_file="$PLATFORMS_MASTER/${rel}"
        if [ ! -f "$master_file" ]; then
            diff_list="$diff_list\n  ADDED: $rel"
            rule_diffs=$((rule_diffs + 1))
        fi
    done < <(find "$PLATFORMS_CHANGED" -name "*.txt" ! -name "*.patch" -print0)

    # Secondary check — metadata
    meta_diffs=$(diff -rq --exclude="*.txt" --exclude="*.patch" \
        "$PLATFORMS_MASTER" "$PLATFORMS_CHANGED" \
        | grep -cE "filters\.(json|js)" || true)

    echo "${C_BOLD}--- Rule Files ---${C_RESET}"
    echo "Total .txt files compared: $total"
    echo "Files with diffs:          $rule_diffs"
    [ -n "$diff_list" ] && printf "$diff_list\n"
    echo ""
    echo "${C_BOLD}--- Metadata Files (informational) ---${C_RESET}"
    echo "filters.json/filters.js diffs: $meta_diffs  (version counter noise, not a regression)"
    echo ""
    echo "${C_BOLD}--- Verdict ---${C_RESET}"
    [ "$rule_diffs" -eq 0 ] \
        && echo "${C_GREEN}${CHECK} PASS${C_RESET} — no rule file diffs" \
        || { echo "${C_RED}${CROSS} FAIL${C_RESET} — $rule_diffs rule file(s) differ"; return 1; }
}

# --- Step 0: reuse existing build output, if any ---

if [ -f "$META_FILE" ] \
    && has_built_output "$PLATFORMS_MASTER" \
    && has_built_output "$PLATFORMS_CHANGED"; then
    load_meta "$META_FILE"
    MODE_LABEL=${BUILD_MODE:-plain}
    echo "Found build output from a previous run ($CHANGED_BRANCH vs $BASE_BRANCH, build mode: $MODE_LABEL)"
    echo "  $BASE_BRANCH @ ${MASTER_SHA:0:9}$(sha_drift_note "$BASE_BRANCH" "$MASTER_SHA")"
    echo "  $CHANGED_BRANCH @ ${CHANGED_SHA:0:9}$(sha_drift_note "$CHANGED_BRANCH" "$CHANGED_SHA")"
    echo "Reuse it for generating the report right now?"
    if confirm; then
        echo "${C_CYAN}${ARROW}${C_RESET} Reusing previous build output ($CHANGED_BRANCH vs $BASE_BRANCH, build mode: $MODE_LABEL)"
        generate_report
        exit $?
    fi
    echo "${C_CYAN}${ARROW}${C_RESET} Removing previous build output, rebuilding"
fi

# --- Step 1: resolve branches ---

CURRENT_BRANCH=$(git branch --show-current)
BRANCHES=()
while IFS= read -r branch_name; do
    BRANCHES+=("$branch_name")
done < <(git for-each-ref --format='%(refname:short)' refs/heads/ | grep -vx "$BASE_BRANCH")

if [ ${#BRANCHES[@]} -eq 0 ]; then
    echo "${C_RED}${CROSS} Error:${C_RESET} no local branches other than $BASE_BRANCH found to compare. Checkout a feature branch first." >&2
    exit 1
fi

# Default the selection to the current branch when it's one of the choices.
DEFAULT_INDEX=0
for i in "${!BRANCHES[@]}"; do
    if [ "${BRANCHES[$i]}" = "$CURRENT_BRANCH" ]; then
        DEFAULT_INDEX=$i
        break
    fi
done

step_header 1 "Local branch to compare against $BASE_BRANCH"

if [ ${#BRANCHES[@]} -eq 1 ]; then
    CHANGED_BRANCH="${BRANCHES[0]}"
    echo "${C_DIM}Only one branch available.${C_RESET}"
else
    for i in "${!BRANCHES[@]}"; do
        marker=""
        [ "${BRANCHES[$i]}" = "$CURRENT_BRANCH" ] && marker="${C_DIM} (current)${C_RESET}"
        printf "  %2d) %s%s\n" "$((i + 1))" "${BRANCHES[$i]}" "$marker"
    done
    default_num=$((DEFAULT_INDEX + 1))
    while true; do
        read -r -p "Select a branch [1-${#BRANCHES[@]}] (default: $default_num): " choice
        choice=${choice:-$default_num}
        if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le ${#BRANCHES[@]} ]; then
            break
        fi
        echo "${C_RED}${CROSS}${C_RESET} Enter a number between 1 and ${#BRANCHES[@]}."
    done
    CHANGED_BRANCH="${BRANCHES[$((choice - 1))]}"
fi
echo "${C_CYAN}${ARROW}${C_RESET} Comparing against branch: $CHANGED_BRANCH"

# --- Step 2: build mode ---

step_header 2 "Build mode"
echo "Use cached sources instead of a regular build?"
if confirm default_no; then
    BUILD_MODE=cached
    echo "${C_CYAN}${ARROW}${C_RESET} Build mode: cached (build:local)"

    # Neither is required every run — an existing filter.txt cache and stats
    # can be reused, so both default to skip.
    echo "Generate filter.txt cache (yarn generate-cache)?"
    if confirm default_no; then
        DO_GENERATE_CACHE=true
        echo "${C_CYAN}${ARROW}${C_RESET} Will run generate-cache before build:local"
    else
        DO_GENERATE_CACHE=false
        echo "${C_CYAN}${ARROW}${C_RESET} Skipping generate-cache, reusing existing cache"
    fi

    echo "Download per-filter stats.json from the cached percent.json (yarn download-stats)?"
    if confirm default_no; then
        DO_GENERATE_STATS=true
        echo "${C_CYAN}${ARROW}${C_RESET} Will run download-stats before build:local"
    else
        DO_GENERATE_STATS=false
        echo "${C_CYAN}${ARROW}${C_RESET} Skipping stats download"
    fi
else
    BUILD_MODE=plain
    DO_GENERATE_CACHE=false
    DO_GENERATE_STATS=false
    echo "${C_CYAN}${ARROW}${C_RESET} Build mode: plain"
fi

# --- Step 3: filter selection ---
# Forwarded as -i=/-s= to generate-cache, download-stats and the build, so a
# quick eval can build a handful of filters instead of the whole registry.

step_header 3 "Filter selection"
INCLUDED_FILTER_IDS=""
EXCLUDED_FILTER_IDS=""
echo "Use filter selection?"
if confirm default_no; then
    echo "${C_CYAN}${ARROW}${C_RESET} Selecting filters"
    read -r -p "Filter IDs to build — yarn --include (comma-separated, blank = all): " INCLUDED_FILTER_IDS
    read -r -p "Filter IDs to exclude — yarn --skip (comma-separated, blank = none): " EXCLUDED_FILTER_IDS
    INCLUDED_FILTER_IDS="${INCLUDED_FILTER_IDS// /}"
    EXCLUDED_FILTER_IDS="${EXCLUDED_FILTER_IDS// /}"
    for _ids in "$INCLUDED_FILTER_IDS" "$EXCLUDED_FILTER_IDS"; do
        if [ -n "$_ids" ] && ! [[ "$_ids" =~ ^[0-9]+(,[0-9]+)*$ ]]; then
            echo "${C_RED}${CROSS} Error:${C_RESET} filter IDs must be digits separated by commas: '$_ids'" >&2
            exit 1
        fi
    done
fi
echo "${C_CYAN}${ARROW}${C_RESET} Filters: include=[${INCLUDED_FILTER_IDS:-all}] exclude=[${EXCLUDED_FILTER_IDS:-none}]"

# --- Step 4: cleanup preference ---

step_header 4 "Cleanup preference"
echo "Remove worktrees and build output when done?"
if confirm; then
    DO_CLEANUP=true
    echo "${C_CYAN}${ARROW}${C_RESET} Cleanup after run: Yes"
else
    DO_CLEANUP=false
    echo "${C_CYAN}${ARROW}${C_RESET} Cleanup after run: No"
fi

if ! MASTER_SHA=$(git rev-parse --verify "$BASE_BRANCH" 2>/dev/null); then
    echo "${C_RED}${CROSS} Error:${C_RESET} local branch '$BASE_BRANCH' not found. Fetch/checkout it first." >&2
    exit 1
fi
CHANGED_SHA=$(git rev-parse "$CHANGED_BRANCH")

# --- Step 5: set up worktrees (reuse if already present) ---

step_header 5 "Set up worktrees"

# Removes the admin entry for a worktree at $1, if it exists but the working tree is missing. Otherwise `git worktree add` will fail as "already registered".
prune_stale_worktree() {
    local path=$1 wt_admin
    [ -e "$path/.git" ] && return 0
    for wt_admin in "$GIT_COMMON_DIR"/worktrees/*/; do
        [ -f "$wt_admin/gitdir" ] || continue
        [ "$(cat "$wt_admin/gitdir" 2>/dev/null)" = "$path/.git" ] && rm -rf "$wt_admin"
    done
}

setup_worktree() {
    local label=$1
    local path=$2
    local sha=$3
    # label is a branch name and may contain "/" (e.g. "feature/#1211"), which
    # would otherwise turn into a nonexistent subdirectory in the log path.
    local escaped_label="${label//\//-}"
    local log_path="$TEMP_DIR_NAME/$LOG_DIR_NAME/worktree-$escaped_label.log"

    if [ -e "$path/.git" ]; then
        echo "[$label] Existing worktree found at $path"
        echo "Reuse it instead of recreating?"
        if confirm default_no; then
            echo "${C_CYAN}${ARROW}${C_RESET} [$label] reusing existing worktree at $path"
            if ! run_with_spinner "[$label] checking out $sha in reused worktree" "$log_path" \
                git -C "$path" checkout -f "$sha"; then
                die "[$label] checkout in reused worktree FAILED" "$log_path"
            fi
            return 0
        fi
        echo "${C_CYAN}${ARROW}${C_RESET} [$label] recreating worktree at $path"
        git worktree remove "$path" -f 2>/dev/null || rm -rf "$path"
    elif [ -e "$path" ]; then
        echo "${C_CYAN}${ARROW}${C_RESET} [$label] removing leftover directory at $path (not a git worktree)"
        rm -rf "$path"
        echo "${C_CYAN}${ARROW}${C_RESET} [$label] creating worktree at $path"
    else
        echo "${C_CYAN}${ARROW}${C_RESET} [$label] creating worktree at $path"
    fi

    prune_stale_worktree "$path"
    if ! run_with_spinner "[$label] setting up worktree" "$log_path" \
        git worktree add --detach "$path" "$sha" -f; then
        die "[$label] worktree setup FAILED" "$log_path"
    fi
}

setup_worktree "$BASE_BRANCH" "$MASTER_WORK_TREE" "$MASTER_SHA"
setup_worktree "$CHANGED_BRANCH" "$CHANGED_WORK_TREE" "$CHANGED_SHA"

# --- Step 6: install deps in parallel ---
# Always runs, even for a reused worktree

step_header 6 "Install dependencies"

yarn --cwd "$MASTER_WORK_TREE" install > "$LOG_MASTER_INSTALL" 2>&1 &
PID_MASTER_INSTALL=$!
yarn --cwd "$CHANGED_WORK_TREE" install > "$LOG_CHANGED_INSTALL" 2>&1 &
PID_CHANGED_INSTALL=$!

spinner_wait_all "$PID_MASTER_INSTALL:[${BASE_BRANCH}] install" "$PID_CHANGED_INSTALL:[$CHANGED_BRANCH] install"

if ! wait "$PID_MASTER_INSTALL"; then
    die "[${BASE_BRANCH}] install FAILED" "$LOG_MASTER_INSTALL"
fi
if ! wait "$PID_CHANGED_INSTALL"; then
    die "[$CHANGED_BRANCH] install FAILED" "$LOG_CHANGED_INSTALL"
fi

# --- Step 7: sync changed worktree's filters/ to the $BASE_BRANCH baseline ---

step_header 7 "Sync filters/ baseline"
if ! run_with_spinner "syncing filters/ to $BASE_BRANCH baseline" "$LOG_SYNC_BASELINE" \
    git -C "$CHANGED_WORK_TREE" checkout "$MASTER_SHA" -- filters/; then
    die "syncing filters/ baseline FAILED" "$LOG_SYNC_BASELINE"
fi

# --- Step 8: build both branches in parallel ---

step_header 8 "Build both branches"

# Clear the platforms/ directory in each worktree to ensure the output
# reflects only the current run. Without this, a filtered build would
# stay at the checked-out commit's files. collect_build will restore the
# original directories after the output is copied.
if ! run_with_spinner "clearing platforms/ in both worktrees" "$LOG_WIPE_PLATFORMS" \
    rm -rf "$MASTER_WORK_TREE/platforms" "$CHANGED_WORK_TREE/platforms"; then
    die "clearing worktree platforms/ FAILED" "$LOG_WIPE_PLATFORMS"
fi

build_branch() {
    local dir=$1 filter_args build_sub
    filter_args=$(filter_flags)
    while IFS= read -r build_sub; do
        # shellcheck disable=SC2086
        yarn --cwd "$dir" $build_sub $filter_args || return 1
    done < <(build_subcommands)
}

( build_branch "$MASTER_WORK_TREE" ) > "$LOG_MASTER_BUILD" 2>&1 &
PID_MASTER_BUILD=$!
( build_branch "$CHANGED_WORK_TREE" ) > "$LOG_CHANGED_BUILD" 2>&1 &
PID_CHANGED_BUILD=$!

spinner_wait_all "$PID_MASTER_BUILD:[$BASE_BRANCH] build" "$PID_CHANGED_BUILD:[$CHANGED_BRANCH] build"

BUILD_FAILED=false

collect_build "$BASE_BRANCH" "$PID_MASTER_BUILD" "$LOG_MASTER_BUILD" \
    "$MASTER_WORK_TREE" "$PLATFORMS_MASTER" "$LOG_COPY_MASTER"
collect_build "$CHANGED_BRANCH" "$PID_CHANGED_BUILD" "$LOG_CHANGED_BUILD" \
    "$CHANGED_WORK_TREE" "$PLATFORMS_CHANGED" "$LOG_COPY_CHANGED"

if [ "$BUILD_FAILED" = true ]; then
    step_header 10 "Cleanup"
    run_cleanup
    exit 1
fi

cat > "$META_FILE" <<EOF
MASTER_SHA=$MASTER_SHA
CHANGED_SHA=$CHANGED_SHA
CHANGED_BRANCH=$CHANGED_BRANCH
BUILD_MODE=$BUILD_MODE
DO_GENERATE_CACHE=$DO_GENERATE_CACHE
DO_GENERATE_STATS=$DO_GENERATE_STATS
INCLUDED_FILTER_IDS=$INCLUDED_FILTER_IDS
EXCLUDED_FILTER_IDS=$EXCLUDED_FILTER_IDS
EOF

# --- Step 9: report ---

step_header 9 "Report"
generate_report
REPORT_STATUS=$?

# --- Step 10: cleanup ---

step_header 10 "Cleanup"
run_cleanup

exit "$REPORT_STATUS"
