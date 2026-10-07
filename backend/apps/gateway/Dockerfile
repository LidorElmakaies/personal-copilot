# Build context is backend/ (the Nest monorepo root), same as every other app here.
#   docker build -f apps/gateway/Dockerfile --build-context version=../version -t personal-copilot-gateway .
# devops/gateway/docker-compose.yml sets context/dockerfile for you.

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
# Webpack is disabled (nest-cli.json) so OTel's require()-hook auto-instrumentation works — see
# backend/libs/otel/src/start-otel.ts's file header.
RUN npm run build:gateway

# Only this service's version, so bumping another one leaves this image (and its build time)
# untouched in the build cache.
FROM node:22-alpine AS own-version
COPY --from=version versions.json /versions.json
RUN node -p "JSON.stringify({ gateway: require('/versions.json')['gateway'] })" > /own-version.json

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist/apps/gateway ./dist/apps/gateway
COPY --from=builder /app/dist/libs ./dist/libs
# Own version + build time, read in-process by GET /admin/status — see docs/specs/services.md#versions.
COPY --from=own-version /own-version.json ./version/versions.json
RUN date -u +%Y-%m-%dT%H:%M:%SZ > ./version/built-at

EXPOSE 8000
CMD ["node", "dist/apps/gateway/src/main.js"]
