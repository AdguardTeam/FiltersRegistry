set -x -e

# Copy old version of filters
git cherry-pick old-platforms

FOLDER_WITH_NEW_FILTERS="platforms"
FOLDER_WITH_OLD_FILTERS="old_platforms"

# Make diff-builder executable
DIFF_BUILDER=node_modules/@adguard/diff-builder/dist/diff-builder
chmod +x "$DIFF_BUILDER"

# Iterate over all *.txt files
for new_filter in "$FOLDER_WITH_NEW_FILTERS"/**/filters/*.txt; do
    # Check if file exists
    if [ -e "$new_filter" ]; then
        path_to_file=$(echo "$new_filter" | sed 's/^[^/]*\///')
        old_filter="$FOLDER_WITH_OLD_FILTERS/$path_to_file"

        dirname=$(dirname "$new_filter")
        basename=$(basename "$new_filter" .txt)
        parent_dir=$(echo "$dirname" | cut -d'/' -f1-2)

        path_to_patches="$parent_dir/patches/$basename"

        # Generate patches
        $($DIFF_BUILDER build $old_filter $new_filter $path_to_patches -n $basename -r h -t 1)
    fi
done

