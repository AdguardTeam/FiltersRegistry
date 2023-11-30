set -x -e

# Save fresh filters and patches to separate branch
git status
git add old_platforms
git commit -m "skip ci. patches and filters from $(date)"
git push --force origin master:old-platforms

# Return HEAD to origin/master
git reset origin/master
