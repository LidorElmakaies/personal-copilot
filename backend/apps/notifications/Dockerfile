# Build context is backend/ (the Nest monorepo root), same as every other app here.
#   docker build -f apps/notifications/Dockerfile --build-context version=../version -t personal-copilot-notifications .
# devops/notifications/docker-compose.yml sets context/dockerfile for you.

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build:notifications

# Only this service's version, so bumping another one leaves this image (and its build time)
# untouched in the build cache.
FROM node:22-alpine AS own-version
COPY --from=version versions.json /versions.json
RUN node -p "JSON.stringify({ notifications: require('/versions.json')['notifications'] })" > /own-version.json

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist/apps/notifications ./dist/apps/notifications
COPY --from=builder /app/dist/libs ./dist/libs
# Own version + build time, read by @app/build-info — see docs/specs/services.md#versions.
COPY --from=own-version /own-version.json ./version/versions.json
RUN date -u +%Y-%m-%dT%H:%M:%SZ > ./version/built-at

# Internal-only — never published to the host, only Gateway calls this (see
# .claude/memory/feedback_gateway_only_service_access.md).
CMD ["node", "dist/apps/notifications/src/main.js"]
