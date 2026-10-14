FROM node:24-slim

# The repository compression tests drive the real git-filter-repo, which needs
# git and Python. The image provides them, so nothing is installed on the runner.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git python3-pip \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m pip install --break-system-packages --no-cache-dir git-filter-repo
