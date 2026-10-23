# Production image of the app. GitHub Actions builds it and pushes it to GHCR;
# the server runs it with deploy/compose.yaml. The same image also runs
# migrations (scripts/migrate.ts) and the test data seed (scripts/seed.ts).

FROM node:24-alpine AS base
ENV CI=true NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
# pnpm version comes from the packageManager field of package.json
COPY package.json ./
RUN npm install -g "$(node -p 'require("./package.json").packageManager')"
COPY pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS deps
RUN pnpm install --frozen-lockfile

FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod

FROM deps AS build
COPY . .
# src/db requires DATABASE_URL on import, but the build never connects:
# pages read data at request time. The real URL comes when the app starts
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm build && \
    rm -rf .next/cache

FROM node:24-alpine AS runner
LABEL org.opencontainers.image.source=https://github.com/111ani/personal-crm
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# Node runs scripts/*.ts as ES modules on its own; package.json has no
# "type" field, so silence the warning about that
ENV NODE_OPTIONS=--disable-warning=MODULE_TYPELESS_PACKAGE_JSON
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json next.config.ts ./
COPY --from=build --chown=node:node /app/.next ./.next
COPY drizzle ./drizzle
COPY scripts ./scripts
COPY src/db/schema.ts ./src/db/schema.ts
# schema.ts takes the list of contact frequencies from here
COPY src/lib/contacts/frequency.ts ./src/lib/contacts/frequency.ts
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
