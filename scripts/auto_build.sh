#!/bin/bash

# This script performs a fully automated build of filters with patches
# and pushes the updated platforms, filters, and report.txt
# to the current repository.

# Enable tracing and exit on error
set -x -e

# Define a list of AdGuard filter IDs
ADGUARD_FILTERS="1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,224"

# Default mode is "all"
MODE="all"

# Loop through command-line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --mode)
            shift
            if [[ "$1" == "all" || "$1" == "adguard" ]]; then
                MODE="$1"
            else
                echo "Invalid mode. Use 'all' or 'adguard' as the mode."
                exit 1
            fi
            shift
            ;;
        *)
            echo "Invalid argument: $1"
            exit 1
            ;;
    esac
done

# Display the selected mode
echo "Selected mode: $MODE"

# Depending on the mode, execute different commands
if [[ "$MODE" == "all" ]]; then
    # Build all filters
    yarn build
    # Set the time live of patches to '4 hours' in seconds
    yarn build:patches --time=14400 --resolution=s
elif [[ "$MODE" == "adguard" ]]; then
    # Build specific AdGuard filters based on the filter IDs
    yarn build --include=$ADGUARD_FILTERS
    # Set the time live of patches to '60 minutes' in seconds
    yarn build:patches --time=3600 --resolution=s
fi

# Validate platforms and locales
yarn validate

# Update built platforms and filters in the repository
yarn push
