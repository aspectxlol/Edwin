FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/edwin ./apps/edwin

RUN corepack enable
RUN pnpm install --frozen-lockfile
RUN pnpm --filter edwin build


FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/edwin ./apps/edwin

RUN pnpm install --frozen-lockfile --prod

CMD ["pnpm", "--filter", "edwin", "start"]