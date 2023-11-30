set -x -e

# Push updated filter lists to the repo (without patches).
git status
git add .
# Exclude old_platforms because we don't want to store changes for it due to its
# size, but leave it in the working tree to load on the server if needed.
git rm --cached -r old_platforms
git diff-index --quiet HEAD || git commit -m "skip ci. build from $(date)"
git push origin master
