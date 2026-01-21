FROM oven/bun:1.3

RUN apt-get update && apt-get install -y \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

COPY . /app

WORKDIR /app/Ayako/packages/Utility
RUN rm -rf ./dist
RUN pnpm install
RUN pnpm run build

WORKDIR /app/Ayako/packages/Gateway
COPY ./.env /app/Ayako/packages/Gateway/.env
RUN rm -rf ./dist
RUN pnpm install
RUN pnpm run build
