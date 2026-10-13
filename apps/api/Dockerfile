# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy workspace configurations and manifests
COPY pnpm-workspace.yaml package.json tsconfig.base.json tsconfig.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/tsup.config.ts packages/shared/
COPY packages/widget/package.json packages/widget/tsconfig.json packages/widget/tsup.config.ts packages/widget/
COPY apps/api/package.json apps/api/tsconfig.json apps/api/tsup.config.ts apps/api/
COPY apps/web/package.json apps/web/tsconfig.json apps/web/

# Copy sources for shared and api
COPY packages/shared/src packages/shared/src
COPY packages/widget/src packages/widget/src
COPY apps/api/src apps/api/src

# Install all dependencies
RUN pnpm install --frozen-lockfile=false

# Build packages/shared and apps/api
RUN pnpm --filter @propbot/shared build
RUN pnpm --filter @propbot/api build

# Stage 2: Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root system user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 propbot

# Copy compiled files and node_modules from builder
COPY --from=builder --chown=propbot:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=propbot:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=propbot:nodejs /app/apps/api/package.json ./package.json

USER propbot

EXPOSE 3000

CMD ["node", "dist/server.js"]
