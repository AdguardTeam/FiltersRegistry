#!/bin/bash

# This script performs a fully automated build of filters with patches
# and pushes the updated platforms, filters, and report file
# to the current repository.

# Enable tracing and exit on error
set -x -e

# Define a list of AdGuard filter IDs
# NOTE: id 12 is not included because it is an obsolete Safari filter.
ADGUARD_FILTERS="1,2,3,4,5,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23,224"

# Default mode is "all"
MODE="all"

# Define paths for wildcard domain expansion
CHROMIUM_MV3_PATH="./platforms/extension/chromium-mv3"
SAFARI_PATH="./platforms/extension/safari"
IOS_PATH="./platforms/ios"
WILDCARD_DOMAINS_JSON_PATH="./scripts/wildcard-domain-processor/wildcard_domains.json"

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
    # Build all filters except ours to keep 1 hour update cycle of patches
    # for our filters.
    yarn build --skip=$ADGUARD_FILTERS --report='report-third-party.txt'

#    # Expand wildcard domains
#    yarn expand-wildcard-domains $CHROMIUM_MV3_PATH $WILDCARD_DOMAINS_JSON_PATH
#    yarn expand-wildcard-domains $SAFARI_PATH $WILDCARD_DOMAINS_JSON_PATH
#    yarn expand-wildcard-domains $IOS_PATH $WILDCARD_DOMAINS_JSON_PATH

    # Set the time live of patches to '4 hours' in seconds
    yarn build:patches --time=14400 --resolution=s --skip=$ADGUARD_FILTERS
elif [[ "$MODE" == "adguard" ]]; then
    # Build specific AdGuard filters based on the filter IDs
    yarn build --include=$ADGUARD_FILTERS --report='report-adguard.txt'

#    # Expand wildcard domains
#    yarn expand-wildcard-domains $CHROMIUM_MV3_PATH $WILDCARD_DOMAINS_JSON_PATH
#    yarn expand-wildcard-domains $SAFARI_PATH $WILDCARD_DOMAINS_JSON_PATH
#    yarn expand-wildcard-domains $IOS_PATH $WILDCARD_DOMAINS_JSON_PATH

    # Set the time live of patches to '60 minutes' in seconds
    yarn build:patches --time=3600 --resolution=s --include=$ADGUARD_FILTERS
fi

# Validate platforms and locales
yarn validate

# Update built platforms and filters in the repository
yarn push
