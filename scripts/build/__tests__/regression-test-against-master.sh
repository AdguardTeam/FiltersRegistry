MASTER_SHA=$(git rev-parse master)
CHANGED_SHA=$(git rev-parse "$CHANGED_BRANCH")

echo "=== Regression Test Report ==="
echo "Branch (reference): master          @ $MASTER_SHA"
echo "Branch (feature):   $CHANGED_BRANCH @ $CHANGED_SHA"
if [ "${BUILD_LOCAL:-false}" = "true" ]; then
  BUILD_CMD="generate-cache && yarn build:local --no-patches-prepare --strip-generated-meta"
else
  BUILD_CMD="build --no-patches-prepare --strip-generated-meta"
fi
echo "Build command:      yarn $BUILD_CMD"
echo "Platforms compared: $(ls platforms_master_build | tr '\n' ' ')"
echo ""

# Total .txt files
TOTAL=$(find platforms_master_build -name "*.txt" ! -name "*.patch" | wc -l | tr -d ' ')

# Primary check — rule files
RULE_DIFFS=0
DIFF_LIST=""

while IFS= read -r -d '' master_file; do
  rel="${master_file#platforms_master_build/}"
  changed_file="platforms_changed_build/${rel}"
  if [ -f "$changed_file" ]; then
    if ! diff -q "$master_file" "$changed_file" > /dev/null 2>&1; then
      DIFF_LIST="$DIFF_LIST\n  DIFF: $rel"
      RULE_DIFFS=$((RULE_DIFFS + 1))
    fi
  else
    DIFF_LIST="$DIFF_LIST\n  MISSING: $rel"
    RULE_DIFFS=$((RULE_DIFFS + 1))
  fi
done < <(find platforms_master_build -name "*.txt" ! -name "*.patch" -print0)

# Secondary check — metadata
META_DIFFS=$(diff -rq --exclude="*.txt" --exclude="*.patch" \
  platforms_master_build platforms_changed_build \
  | grep -cE "filters\.(json|js)" || true)

echo "--- Rule Files ---"
echo "Total .txt files compared: $TOTAL"
echo "Files with diffs:          $RULE_DIFFS"
[ -n "$DIFF_LIST" ] && printf "$DIFF_LIST\n"
echo ""
echo "--- Metadata Files (informational) ---"
echo "filters.json/filters.js diffs: $META_DIFFS  (version counter noise, not a regression)"
echo ""
echo "--- Verdict ---"
[ "$RULE_DIFFS" -eq 0 ] && echo "PASS — no rule file diffs" || { echo "FAIL — $RULE_DIFFS rule file(s) differ"; exit 1; }
