# syntax=docker/dockerfile:1

# ─── Stage 1: Build ───────────────────────────────────────────────────────────
# Build inside the Lambda base image so native binaries (DuckDB) are compiled
# for Amazon Linux 2023 / glibc 2.34 — matching the Lambda execution environment.
FROM public.ecr.aws/lambda/nodejs:22 AS builder

WORKDIR /build

# Install pnpm (same major version as used in the monorepo).
RUN npm install -g pnpm@10

# Copy workspace manifests and shared TypeScript config first for layer caching.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/core/package.json ./packages/core/
COPY apps/server/package.json ./apps/server/

# Install all workspace deps (including devDeps for building).
RUN pnpm install --frozen-lockfile

# Copy source files.
COPY packages/core/ ./packages/core/
COPY apps/server/ ./apps/server/

# Build packages/core first (apps/server depends on it).
RUN pnpm --filter @my-binder/core build

# Build apps/server: tsc → tsc-alias (rewrites @src/* paths) → copy migrations.
RUN pnpm --filter @my-binder/server build

# Flatten production dependencies for apps/server into a clean output directory.
# pnpm deploy copies runtime node_modules + compiled workspace deps (core).
RUN pnpm deploy --filter @my-binder/server --prod /deploy/server --legacy

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM public.ecr.aws/lambda/nodejs:22

WORKDIR ${LAMBDA_TASK_ROOT}

# Copy flattened production node_modules (includes @duckdb/node-bindings-linux-x64).
COPY --from=builder /deploy/server/node_modules ./node_modules

# Copy compiled server code (tsc output with path aliases rewritten).
COPY --from=builder /build/apps/server/dist ./dist

# Lambda handler: dist/src/lambda.js, export named "handler".
CMD ["dist/src/lambda.handler"]
