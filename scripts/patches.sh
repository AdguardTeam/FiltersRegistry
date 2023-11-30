set -x -e

# Copy old version of filters
git checkout old-platforms -- old_platforms

FOLDER_WITH_NEW_FILTERS="platforms"
FOLDER_WITH_OLD_FILTERS="old_platforms"

# Make diff-builder executable
DIFF_BUILDER=node_modules/@adguard/diff-builder/dist/diff-builder
chmod +x "$DIFF_BUILDER"

# Iterate over all *.txt files in all 'filters/' folders inside $FOLDER_WITH_NEW_FILTERS
all_filters=$(find platforms -type d -name filters -exec find {} -type f -name "*.txt" \;)
echo $all_filters
for new_filter in $all_filters; do
    # Check if file exists
    if [ -e "$new_filter" ]; then
        path_to_file=$(echo "$new_filter" | sed 's/^[^/]*\///')
        old_filter="$FOLDER_WITH_OLD_FILTERS/$path_to_file"

        dirname=$(dirname "$new_filter")
        basename=$(basename "$new_filter" .txt)
        parent_dir=$(dirname "$dirname")

        path_to_patches="$parent_dir/patches/$basename"

        # Generate patches
        $DIFF_BUILDER build -n $basename -r h -t 1 -v $old_filter $new_filter $path_to_patches
    fi
done

# Move all generated patches with fresh filters into old_platforms
cp -a platforms/. old_platforms/
