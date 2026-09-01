# syntax=docker/dockerfile:1

# ============ Builder ============
FROM node:24-alpine AS builder

WORKDIR /app

# Enable pnpm via corepack (matches lockfileVersion 9)
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

# Install dependencies first for better layer caching.
# The patchedDependency (whatsapp-rust-bridge) needs the patches/ dir.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# Build TypeScript -> dist/
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
RUN pnpm build

# Prune to production dependencies for the runtime layer.
RUN pnpm prune --prod

# ============ Runner ============
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Asia/Jakarta

# tini: proper PID 1 — forwards SIGTERM so the bot shuts down cleanly
# (WhatsApp session stays healthy on container restarts).
RUN apk add --no-cache tini

# Non-root user
RUN addgroup -S edwin && adduser -S edwin -G edwin

COPY --from=builder --chown=edwin:edwin /app/node_modules ./node_modules
COPY --from=builder --chown=edwin:edwin /app/dist ./dist
COPY --from=builder --chown=edwin:edwin /app/drizzle ./drizzle
COPY --from=builder --chown=edwin:edwin /app/package.json ./

# Baileys auth session — MUST be a persistent volume or you re-scan the
# QR code (and risk a WhatsApp number ban) on every deploy.
RUN mkdir -p /app/auth && chown edwin:edwin /app/auth
VOLUME ["/app/auth"]

USER edwin

EXPOSE 3000

# Apply DB migrations, then start the bot.
CMD ["sh", "-c", "node node_modules/drizzle-kit/bin.cjs migrate && node dist/index.js"]