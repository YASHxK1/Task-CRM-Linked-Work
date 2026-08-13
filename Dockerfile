# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: install dependencies and build the app
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

# Install all deps first (layers cached unless the lockfile changes)
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# Build client (Vite) + server/schema bundles (esbuild)
COPY . .
RUN pnpm build

# ---------------------------------------------------------------------------
# Stage 2: minimal runtime image (production deps only)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Production deps only (server bundles use --packages=external)
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --prod --frozen-lockfile

# Bundled server, static client, and the schema bootstrap SQL
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Ensure DB schema exists (idempotent), then boot the HTTP server.
CMD ["sh", "-c", "node dist/ensureSchema.js && node dist/index.js"]