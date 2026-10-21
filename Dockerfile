FROM node:20-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY babel.config.js webpack.config.js ./
COPY react-client ./react-client
COPY server ./server
COPY lib ./lib
COPY db-controllers ./db-controllers
COPY database-postgresql ./database-postgresql

RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/react-client/dist ./react-client/dist
COPY --chown=node:node server ./server
COPY --chown=node:node lib ./lib
COPY --chown=node:node db-controllers ./db-controllers
COPY --chown=node:node database-postgresql ./database-postgresql

USER node
EXPOSE 3001
CMD ["node", "server/index.js"]
