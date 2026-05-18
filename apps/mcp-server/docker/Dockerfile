# syntax=docker/dockerfile:1.7
#
# leverie-mcp — Standalone MCP server image
#
# Build from the repository root:
#   docker build -f apps/mcp-server/docker/Dockerfile -t leverie-mcp:dev .
#
# Run (Claude Desktop / Cursor / Cline spawn this with stdin attached):
#   docker run -i --rm -v "$(pwd)/logics:/logics:ro" leverie-mcp:dev
#
# Default CMD is `serve /logics`. Override to point at a single file, e.g.:
#   docker run -i --rm -v "$(pwd)/loan.json:/logics/loan.json:ro" \
#     leverie-mcp:dev serve /logics/loan.json

ARG NODE_VERSION=22-alpine

# ---------- Stage 1: build ----------
FROM node:${NODE_VERSION} AS builder

RUN corepack enable

WORKDIR /repo

# Copy all workspace manifests first so dependency resolution is cacheable
# independent of source changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./
COPY apps/mcp-server/package.json apps/mcp-server/
COPY apps/editor/package.json apps/editor/
COPY packages/engine/package.json packages/engine/
COPY packages/schema/package.json packages/schema/
COPY packages/checks/package.json packages/checks/

# Install only what leverie-mcp transitively needs (skips the editor app's deps).
RUN --mount=type=cache,id=pnpm,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store && \
    pnpm install --frozen-lockfile --filter leverie-mcp...

# Copy sources for the build.
COPY apps/mcp-server apps/mcp-server
COPY packages packages

# Compile leverie-mcp and every workspace dep it transitively pulls in
# (engine, schema). `...` is pnpm's "include dependencies" recursion.
RUN pnpm --filter "leverie-mcp..." build

# Produce a self-contained bundle with workspace deps inlined and devDeps stripped.
# `--legacy` is required since our workspace doesn't use injected dependencies
# (pnpm v10+ defaults to the injected-only flow).
RUN pnpm --filter leverie-mcp --prod --legacy deploy /out

# `pnpm deploy` doesn't apply each package's `publishConfig` overrides, so the
# deployed workspace packages still point `exports` at their `.ts` sources.
# We rewrite those package.json files to mirror what `pnpm publish` would have
# produced. See the script header for context (pnpm/pnpm#6693).
COPY apps/mcp-server/docker/apply-publish-config.mjs /tmp/apply-publish-config.mjs
RUN node /tmp/apply-publish-config.mjs /out/node_modules

# ---------- Stage 2: runtime ----------
FROM node:${NODE_VERSION} AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /out/dist ./dist
COPY --from=builder /out/node_modules ./node_modules
COPY --from=builder /out/package.json ./package.json

# Drop privileges to the prebuilt `node` user.
USER node

# Default mount point for users' Logic JSON files.
WORKDIR /logics

ENTRYPOINT ["node", "/app/dist/cli.js"]
CMD ["serve", "/logics"]

# OCI image metadata — picked up by GHCR for repo linking and tag display.
LABEL org.opencontainers.image.title="leverie-mcp" \
      org.opencontainers.image.description="Standalone MCP server for LEVERIE decision logic." \
      org.opencontainers.image.source="https://github.com/remi0753/leverie" \
      org.opencontainers.image.documentation="https://github.com/remi0753/leverie/tree/main/apps/mcp-server#readme" \
      org.opencontainers.image.licenses="Apache-2.0"
