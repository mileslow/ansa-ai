FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY api ./api
COPY lib ./lib
COPY cloud-run/server.ts ./cloud-run/server.ts
RUN ./node_modules/.bin/esbuild cloud-run/server.ts \
  --bundle \
  --platform=node \
  --format=esm \
  --target=node22 \
  --packages=external \
  --sourcemap \
  --outfile=cloud-run/dist/server.mjs

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    NODE_OPTIONS=--enable-source-maps \
    PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxss1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /app/cloud-run/dist/server.mjs ./server.mjs
COPY --from=build --chown=node:node /app/cloud-run/dist/server.mjs.map ./server.mjs.map

USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
