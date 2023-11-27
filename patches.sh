set -x -e

folder_with_new_filters="platforms"
folder_with_old_filters="old_platforms"

# Make diff-builder executable
diff_builder=node_modules/@adguard/diff-builder/dist/diff-builder
chmod +x "$diff_builder"

# Iterate over all *.txt files
for new_filter in "$folder_with_new_filters"/**/filters/*.txt; do
    # Check if file exists
    if [ -e "$new_filter" ]; then
        path_to_file=$(echo "$new_filter" | sed 's/^[^/]*\///')
        old_filter="$folder_with_old_filters/$path_to_file"

        dirname=$(dirname "$new_filter")
        basename=$(basename "$new_filter" .txt)
        parent_dir=$(echo "$dirname" | cut -d'/' -f1-2)

        path_to_patches="$parent_dir/patches/$basename"

        # Generate patches
        $($diff_builder build $old_filter $new_filter $path_to_patches -n $basename -r h -t 1)
    fi
done

