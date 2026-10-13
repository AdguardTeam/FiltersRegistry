FROM node:24-slim

# The tests need git and Python (the repository compression tests drive the real
# git-filter-repo) and curl (the compiler downloads optimization statistics).
# The image provides them, so nothing is installed on the runner.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git curl python3-pip \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m pip install --break-system-packages --no-cache-dir git-filter-repo

WORKDIR /repo

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

CMD ["yarn", "test"]
