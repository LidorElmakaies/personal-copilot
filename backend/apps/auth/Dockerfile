# Build context is backend/ (the Nest monorepo root), same as every other app here.
#   docker build -f apps/auth/Dockerfile -t shabbat-notifier-auth .
# devops/auth/docker-compose.yml sets context/dockerfile for you.

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build:auth

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist/apps/auth ./dist/apps/auth
COPY --from=builder /app/dist/libs ./dist/libs

# Internal-only — never published to the host, only Gateway calls this (see
# .claude/memory/feedback_gateway_only_service_access.md).
CMD ["node", "dist/apps/auth/src/main.js"]
