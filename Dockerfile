FROM node:alpine
WORKDIR /app

COPY ./package.json /app/package.json
COPY ./pnpm-lock.yaml /app/pnpm-lock.yaml
RUN npm install -g pnpm

RUN pnpm install
RUN pnpm build

COPY . /app
WORKDIR /app
COPY ./.env /app/.env

WORKDIR /app