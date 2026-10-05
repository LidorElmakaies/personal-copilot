# Web export only — see docs/specs/architecture.md#compose--build-layout for why.
#   docker build --build-context version=../version -t personal-copilot-frontend .

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
# Must be a build ARG, not a runtime env var — see docs/specs/architecture.md#compose--build-layout.
ARG GATEWAY_PUBLIC_URL=http://localhost:8000
ENV EXPO_PUBLIC_GATEWAY_ORIGIN=$GATEWAY_PUBLIC_URL
# Versions (version/versions.json, a separate build context) and build time, inlined by Metro —
# src/config/version.js.
COPY --from=version versions.json /version/versions.json
RUN EXPO_PUBLIC_APP_VERSION=$(node -p "require('/version/versions.json').app")     EXPO_PUBLIC_FRONTEND_VERSION=$(node -p "require('/version/versions.json').frontend")     EXPO_PUBLIC_BUILT_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)     npm run build:web

FROM caddy:2-alpine AS runner
COPY --from=builder /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
