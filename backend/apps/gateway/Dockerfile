# Build context is backend/ (the Nest monorepo root), same as every other app here.
#   docker build -f apps/gateway/Dockerfile -t shabbat-notifier-gateway .
# devops/gateway/docker-compose.yml sets context/dockerfile for you.

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
# Webpack is disabled (nest-cli.json) so OTel's require()-hook auto-instrumentation works — see
# backend/libs/otel/src/start-otel.ts's file header.
RUN npm run build:gateway

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist/apps/gateway ./dist/apps/gateway
COPY --from=builder /app/dist/libs ./dist/libs

EXPOSE 8000
CMD ["node", "dist/apps/gateway/src/main.js"]
