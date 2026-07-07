FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/realtime/package.json apps/realtime/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build --workspace @cosmere/realtime
# 裁掉 devDependencies，保留 prisma 生成产物（.prisma），并做启动自检
RUN cp -r node_modules/.prisma /tmp/.prisma \
  && npm prune --omit=dev --no-audit --no-fund \
  && rm -rf node_modules/.prisma \
  && mv /tmp/.prisma node_modules/.prisma \
  && node -e "require('@prisma/client')"

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/realtime/dist ./apps/realtime/dist
COPY --from=builder /app/package.json ./package.json
EXPOSE 4001
CMD ["node", "apps/realtime/dist/server.cjs"]
