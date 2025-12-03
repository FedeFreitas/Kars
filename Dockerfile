# syntax=docker/dockerfile:1

FROM node:20.18.0-slim AS base
WORKDIR /app

FROM base AS deps
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3 && \
    rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package-lock.json ./apps/web/
RUN npm ci --include=dev --prefix apps/web

FROM base AS build
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app/apps/web
COPY --from=build /app/apps/web/.next ./.next
COPY --from=build /app/apps/web/public ./public
COPY --from=build /app/apps/web/package.json ./package.json
COPY --from=deps /app/apps/web/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start"]
