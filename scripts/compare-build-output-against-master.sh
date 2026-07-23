#!/bin/bash

# Compare build output: build master and a compare branch in parallel git worktrees,
# then diff their compiled platform output. See "Typical workflow — comparing
# build results against master" in DEVELOPMENT.md.
#
# Usage: yarn compare-build-output

BASED_BRANCH="master"

# Without this, a missing yarn only surfaces minutes later as an install/build
# log failure instead of failing fast up front.
command -v yarn >/dev/null 2>&1 || { echo "Error: yarn not found on PATH." >&2; exit 1; }

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT" || exit 1

# Removes worktree info for worktrees whose working trees are missing
# (https://git-scm.com/docs/git-worktree#Documentation/git-worktree.txt-prune),
# e.g. if temp/ was ever deleted manually instead of via `git worktree remove`.
# To verify: `rm -rf temp/reg-master-build`, then rerun — `git worktree add`
# would otherwise fail as "already registered".
git worktree prune

TEMP_DIR_NAME="$REPO_ROOT/temp"
mkdir -p "$TEMP_DIR_NAME"

# Lives outside $TEMP_DIR_NAME (unlike the deterministic name, so cleanup_all's
# `find $TEMP_DIR_NAME -mindepth 1 ...` never touches it while still held) and
# guards against two concurrent runs corrupting the same shared worktrees/logs.
LOCK_DIR="${TMPDIR:-/tmp}/compare-build-output-$(basename "$REPO_ROOT").lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Error: another compare-build-output run appears to be in progress (lock: $LOCK_DIR)." >&2
  echo "If you're sure none is running, remove that directory and retry." >&2
  exit 1
fi
trap 'rm -rf "$LOCK_DIR"' EXIT

MASTER_WORK_TREE="$TEMP_DIR_NAME/reg-${BASED_BRANCH}-build"
CHANGED_WORK_TREE="$TEMP_DIR_NAME/reg-changed-build"
META_FILE="$TEMP_DIR_NAME/reg-meta.env"
PLATFORMS_MASTER="$TEMP_DIR_NAME/platforms_${BASED_BRANCH}_build"
PLATFORMS_CHANGED="$TEMP_DIR_NAME/platforms_changed_build"

LOG_DIR_NAME="logs"
mkdir -p "$TEMP_DIR_NAME/$LOG_DIR_NAME"

LOG_MASTER_INSTALL="$TEMP_DIR_NAME/$LOG_DIR_NAME/${BASED_BRANCH}-install.txt"
LOG_CHANGED_INSTALL="$TEMP_DIR_NAME/$LOG_DIR_NAME/changed-install.txt"
LOG_MASTER_BUILD="$TEMP_DIR_NAME/$LOG_DIR_NAME/${BASED_BRANCH}-build.txt"
LOG_CHANGED_BUILD="$TEMP_DIR_NAME/$LOG_DIR_NAME/changed-build.txt"
LOG_SYNC_BASELINE="$TEMP_DIR_NAME/$LOG_DIR_NAME/sync-baseline.txt"
LOG_COPY_MASTER="$TEMP_DIR_NAME/$LOG_DIR_NAME/copy-${BASED_BRANCH}.txt"
LOG_COPY_CHANGED="$TEMP_DIR_NAME/$LOG_DIR_NAME/copy-changed.txt"
LOG_CLEANUP="$TEMP_DIR_NAME/$LOG_DIR_NAME/cleanup.txt"

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
TOTAL_STEPS=9

# Prints a blank line and a bold "Step N/9: <title>" header.
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

# The existing pass/fail comparison report. Reads MASTER_SHA / CHANGED_SHA /
# CHANGED_BRANCH / BUILD_LOCAL and the platforms_{master,changed}_build/ dirs.
generate_report() {
  local build_cmd total rule_diffs diff_list meta_diffs
  local master_file rel changed_file changed_only_file

  echo "${C_BOLD}=== Regression Test Report ===${C_RESET}"
  echo "Branch (reference): $BASED_BRANCH          @ $MASTER_SHA"
  echo "Branch (feature):   $CHANGED_BRANCH @ $CHANGED_SHA"
  if [ "${BUILD_LOCAL:-false}" = "true" ]; then
    build_cmd="generate-cache && yarn build:local --no-patches-prepare --strip-generated-meta"
  else
    build_cmd="build --no-patches-prepare --strip-generated-meta"
  fi
  echo "Build command:      yarn $build_cmd"
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

if [ -f "$META_FILE" ] && [ -d "$PLATFORMS_MASTER" ] && [ -d "$PLATFORMS_CHANGED" ]; then
  # shellcheck disable=SC1090
  source "$META_FILE"
  MODE_LABEL="plain"
  [ "$BUILD_LOCAL" = "true" ] && MODE_LABEL="cached"
  echo "Found build output from a previous run ($CHANGED_BRANCH vs $BASED_BRANCH, $MODE_LABEL) — generate the report from it now instead of rebuilding?"
  if confirm; then
    echo "${C_CYAN}${ARROW}${C_RESET} Reusing previous build output ($CHANGED_BRANCH vs $BASED_BRANCH, $MODE_LABEL)"
    generate_report
    exit $?
  fi
  echo "${C_CYAN}${ARROW}${C_RESET} Ignoring previous build output, rebuilding"
fi

# --- Step 1: resolve branches ---

CURRENT_BRANCH=$(git branch --show-current)
BRANCHES=()
while IFS= read -r branch_name; do
  BRANCHES+=("$branch_name")
done < <(git for-each-ref --format='%(refname:short)' refs/heads/ | grep -vx "$BASED_BRANCH")

if [ ${#BRANCHES[@]} -eq 0 ]; then
  echo "${C_RED}${CROSS} Error:${C_RESET} no local branches other than $BASED_BRANCH found to compare. Checkout a feature branch first." >&2
  exit 1
fi

SELECTED_INDEX=0
HAS_CURRENT_DEFAULT=false
for i in "${!BRANCHES[@]}"; do
  if [ "${BRANCHES[$i]}" = "$CURRENT_BRANCH" ]; then
    SELECTED_INDEX=$i
    HAS_CURRENT_DEFAULT=true
    break
  fi
done

draw_branch_menu() {
  local selected=$1
  local i label
  for i in "${!BRANCHES[@]}"; do
    label="${BRANCHES[$i]}"
    if [ "${BRANCHES[$i]}" = "$CURRENT_BRANCH" ]; then
      label="$label${C_DIM} (current)${C_RESET}"
    fi
    [ -t 1 ] && printf "\r\033[K"
    if [ "$i" -eq "$selected" ]; then
      printf "  %s❯ %s%s\n" "$C_CYAN" "$label" "$C_RESET"
    else
      printf "    %s\n" "$label"
    fi
  done
}

step_header 1 "Branch to compare against $BASED_BRANCH"
echo "(↑/↓ to move, Enter to select):"
if [ "$HAS_CURRENT_DEFAULT" = false ]; then
  echo "${C_DIM}No current branch to default to (detached HEAD or on $BASED_BRANCH) — defaulting to the first branch.${C_RESET}"
fi
draw_branch_menu "$SELECTED_INDEX"

while true; do
  IFS= read -rsn1 KEY
  if [ "$KEY" = $'\x1b' ]; then
    # bash on macOS (3.2) only accepts integer `read -t` timeouts, so this
    # waits up to 1s for the rest of an arrow-key escape sequence (which
    # arrives within milliseconds); a lone Esc keypress just waits it out.
    read -rsn2 -t 1 KEY_REST
    KEY+="$KEY_REST"
  fi
  case "$KEY" in
    $'\x1b[A')
      SELECTED_INDEX=$(( (SELECTED_INDEX - 1 + ${#BRANCHES[@]}) % ${#BRANCHES[@]} ))
      ;;
    $'\x1b[B')
      SELECTED_INDEX=$(( (SELECTED_INDEX + 1) % ${#BRANCHES[@]} ))
      ;;
    "" | $'\n' | $'\r')
      break
      ;;
  esac
  [ -t 1 ] && printf "\033[%dA" "${#BRANCHES[@]}"
  draw_branch_menu "$SELECTED_INDEX"
done

CHANGED_BRANCH="${BRANCHES[$SELECTED_INDEX]}"
echo "${C_CYAN}${ARROW}${C_RESET} Comparing against branch: $CHANGED_BRANCH"

# --- Step 2: build mode ---

step_header 2 "Build mode"
echo "Use cached build (generate-cache + build:local) instead of a plain build?"
if confirm; then
  BUILD_LOCAL=true
  echo "${C_CYAN}${ARROW}${C_RESET} Build mode: cached (generate-cache + build:local)"
else
  BUILD_LOCAL=false
  echo "${C_CYAN}${ARROW}${C_RESET} Build mode: plain"
fi

# --- Step 3: cleanup preference ---

step_header 3 "Cleanup preference"
echo "Remove worktrees and platforms_*_build/ when done?"
if confirm; then
  DO_CLEANUP=true
  echo "${C_CYAN}${ARROW}${C_RESET} Cleanup after run: Yes"
else
  DO_CLEANUP=false
  echo "${C_CYAN}${ARROW}${C_RESET} Cleanup after run: No"
fi

MASTER_SHA=$(git rev-parse "$BASED_BRANCH")
CHANGED_SHA=$(git rev-parse "$CHANGED_BRANCH")

# --- Step 4: set up worktrees (reuse if already present) ---

step_header 4 "Set up worktrees"
setup_worktree() {
  local label=$1
  local path=$2
  local sha=$3
  # label is a branch name and may contain "/" (e.g. "feature/#1211"), which
  # would otherwise turn into a nonexistent subdirectory in the log path.
  local escaped_label="${label//\//-}"
  local log_path="$TEMP_DIR_NAME/$LOG_DIR_NAME/worktree-$escaped_label.txt"

  if [ -e "$path/.git" ]; then
    echo "[$label] Existing worktree found at $path — reuse it instead of recreate from scratch?"
    if confirm default_no; then
      echo "${C_CYAN}${ARROW}${C_RESET} [$label] reusing existing worktree at $path"
      git -C "$path" checkout -f "$sha"
      return 0
    fi
    echo "${C_CYAN}${ARROW}${C_RESET} [$label] recreating worktree at $path"
    git worktree remove "$path" -f 2>/dev/null || rm -rf "$path"
  else
    echo "${C_CYAN}${ARROW}${C_RESET} [$label] creating worktree at $path"
  fi

  if ! run_with_spinner "[$label] setting up worktree" "$log_path" \
    git worktree add --detach "$path" "$sha" -f; then
    report_failure "[$label] worktree setup FAILED" "$log_path"
    exit 1
  fi
}

setup_worktree "$BASED_BRANCH" "$MASTER_WORK_TREE" "$MASTER_SHA"
setup_worktree "$CHANGED_BRANCH" "$CHANGED_WORK_TREE" "$CHANGED_SHA"

# --- Step 5: install deps in parallel, skipping worktrees that kept node_modules ---

step_header 5 "Install dependencies"
INSTALL_JOBS=()
INSTALL_LOGS=()

if [ ! -d "$MASTER_WORK_TREE/node_modules" ]; then
  yarn --cwd "$MASTER_WORK_TREE" install > "$LOG_MASTER_INSTALL" 2>&1 &
  INSTALL_JOBS+=("$!:[${BASED_BRANCH}] install")
  INSTALL_LOGS+=("$LOG_MASTER_INSTALL")
else
  echo "${C_CYAN}${ARROW}${C_RESET} [${BASED_BRANCH}] node_modules present, skipping install"
fi

if [ ! -d "$CHANGED_WORK_TREE/node_modules" ]; then
  yarn --cwd "$CHANGED_WORK_TREE" install > "$LOG_CHANGED_INSTALL" 2>&1 &
  INSTALL_JOBS+=("$!:[$CHANGED_BRANCH] install")
  INSTALL_LOGS+=("$LOG_CHANGED_INSTALL")
else
  echo "${C_CYAN}${ARROW}${C_RESET} [$CHANGED_BRANCH] node_modules present, skipping install"
fi

if [ ${#INSTALL_JOBS[@]} -gt 0 ]; then
  spinner_wait_all "${INSTALL_JOBS[@]}"
  for idx in "${!INSTALL_JOBS[@]}"; do
    job="${INSTALL_JOBS[$idx]}"
    log="${INSTALL_LOGS[$idx]}"
    pid="${job%%:*}"
    label="${job#*:}"
    if ! wait "$pid"; then
      report_failure "$label FAILED" "$log"
      exit 1
    fi
  done
fi

# --- Step 6: sync changed worktree's filters/ to the $BASED_BRANCH baseline ---

step_header 6 "Sync filters/ baseline"
if ! run_with_spinner "syncing filters/ to $BASED_BRANCH baseline" "$LOG_SYNC_BASELINE" \
  git -C "$CHANGED_WORK_TREE" checkout "$MASTER_SHA" -- filters/; then
  report_failure "syncing filters/ baseline FAILED" "$LOG_SYNC_BASELINE"
  exit 1
fi

# --- Step 7: build both branches in parallel ---

step_header 7 "Build both branches"
if [ "$BUILD_LOCAL" = "true" ]; then
  build_branch() {
    yarn --cwd "$1" generate-cache && yarn --cwd "$1" build:local --no-patches-prepare --strip-generated-meta
  }
else
  build_branch() {
    yarn --cwd "$1" build --no-patches-prepare --strip-generated-meta
  }
fi

( build_branch "$MASTER_WORK_TREE" ) > "$LOG_MASTER_BUILD" 2>&1 &
PID_MASTER_BUILD=$!
( build_branch "$CHANGED_WORK_TREE" ) > "$LOG_CHANGED_BUILD" 2>&1 &
PID_CHANGED_BUILD=$!

spinner_wait_all "$PID_MASTER_BUILD:[$BASED_BRANCH] build" "$PID_CHANGED_BUILD:[$CHANGED_BRANCH] build"

BUILD_FAILED=false

if wait "$PID_MASTER_BUILD"; then
  # A prior kept run's output may still be here; cp -r would merge into it
  # rather than replace it, silently mixing stale files into the diff.
  rm -rf "$PLATFORMS_MASTER"
  if run_with_spinner "[$BASED_BRANCH] copying platforms/ output" "$LOG_COPY_MASTER" \
    cp -r "$MASTER_WORK_TREE/platforms" "$PLATFORMS_MASTER"; then
    echo "${C_GREEN}${CHECK}${C_RESET} [$BASED_BRANCH] build done"
  else
    report_failure "[$BASED_BRANCH] copying platforms/ output FAILED" "$LOG_COPY_MASTER"
    BUILD_FAILED=true
  fi
else
  report_failure "[$BASED_BRANCH] build FAILED" "$LOG_MASTER_BUILD"
  BUILD_FAILED=true
fi

if wait "$PID_CHANGED_BUILD"; then
  rm -rf "$PLATFORMS_CHANGED"
  if run_with_spinner "[$CHANGED_BRANCH] copying platforms/ output" "$LOG_COPY_CHANGED" \
    cp -r "$CHANGED_WORK_TREE/platforms" "$PLATFORMS_CHANGED"; then
    echo "${C_GREEN}${CHECK}${C_RESET} [$CHANGED_BRANCH] build done"
  else
    report_failure "[$CHANGED_BRANCH] copying platforms/ output FAILED" "$LOG_COPY_CHANGED"
    BUILD_FAILED=true
  fi
else
  report_failure "[$CHANGED_BRANCH] build FAILED" "$LOG_CHANGED_BUILD"
  BUILD_FAILED=true
fi

if [ "$BUILD_FAILED" = true ]; then
  exit 1
fi

cat > "$META_FILE" <<EOF
MASTER_SHA=$MASTER_SHA
CHANGED_SHA=$CHANGED_SHA
CHANGED_BRANCH=$CHANGED_BRANCH
BUILD_LOCAL=$BUILD_LOCAL
EOF

# --- Step 8: report ---

step_header 8 "Report"
generate_report
REPORT_STATUS=$?

# --- Step 9: cleanup ---

step_header 9 "Cleanup"
cleanup_all() {
  git worktree remove "$MASTER_WORK_TREE" -f 2>/dev/null || rm -rf "$MASTER_WORK_TREE"
  git worktree remove "$CHANGED_WORK_TREE" -f 2>/dev/null || rm -rf "$CHANGED_WORK_TREE"
  # Remove everything under $TEMP_DIR_NAME except $LOG_DIR_NAME, so logs
  # from this run stay available for inspection after cleanup.
  find "$TEMP_DIR_NAME" -mindepth 1 -maxdepth 1 ! -name "$LOG_DIR_NAME" -exec rm -rf {} +
}

if [ "$DO_CLEANUP" = true ]; then
  if run_with_spinner "cleaning up worktrees and build output" "$LOG_CLEANUP" cleanup_all; then
    rm -f "$LOG_CLEANUP"
  else
    report_failure "cleanup FAILED" "$LOG_CLEANUP"
  fi
else
  echo "${C_CYAN}${ARROW}${C_RESET} Kept for later use: $MASTER_WORK_TREE, $CHANGED_WORK_TREE, $PLATFORMS_MASTER, $PLATFORMS_CHANGED"
fi

exit "$REPORT_STATUS"
