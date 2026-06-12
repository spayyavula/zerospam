# syntax=docker/dockerfile:1

# ---- build ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
# All workspace manifests must be present so npm can resolve the lockfile graph.
COPY package*.json ./
COPY packages/shared-api/package*.json packages/shared-api/
COPY server/package*.json server/
COPY web/package*.json web/
COPY apps/mobile/package*.json apps/mobile/
# Install only the workspaces needed to build the server image (skip mobile).
RUN npm ci --include-workspace-root \
      --workspace=@zerospam/shared-api --workspace=web --workspace=server
COPY . .
# Node auto-sizes V8's heap from physical RAM; on small build hosts (e.g. a 2 GB
# instance) tsc/vite exceed that cap and abort (code 134) even with free swap.
# Raise it explicitly so the image builds on small instances.
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build:shared-api \
 && npm run build --workspace=web \
 && npm run build --workspace=server

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Same manifests for lockfile resolution; install prod deps for server + root only.
COPY package*.json ./
COPY packages/shared-api/package*.json packages/shared-api/
COPY server/package*.json server/
COPY web/package*.json web/
COPY apps/mobile/package*.json apps/mobile/
RUN npm ci --omit=dev --include-workspace-root --workspace=server
# Built artifacts
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/packages/shared-api/dist packages/shared-api/dist
COPY --from=build /app/web/dist web/dist
EXPOSE 25 8025
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8025/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/dist/index.js"]
