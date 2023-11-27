set -x -e

# Prepare the filter lists
cd ./FiltersRegistry
yarn install ${YARN_ARGS}
node index.js $@
node validate.js

# Copy old version of filters
git cherry-pick old-platforms

# Generate patches
./patches.sh

# Push filters and patches to separate branch
cp -r platforms/ old_platforms/
git status
git add old_platforms
git commit -m "skip ci. old patches and filters from $(date)"
git push --force origin old-platforms

# Clean old filters
git reset origin/master
rm -rf old_platforms/

# Push updated filter lists to the repo.
git status
git add .
git diff-index --quiet HEAD || git commit -m "skip ci. build from $(date)"
git push origin master

# Push filter lists to the filters server
RSYNC_PASSWORD=${RSYNC_PASSWORD} rsync -aH ./platforms/* builder@filters.rsync.service.eu.consul::filters/
curl -X POST ${PURGE_URL}/filters
