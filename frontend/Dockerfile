# Web export only — see docs/specs/architecture.md#compose--build-layout for why.
#   docker build -t personal-copilot-frontend .

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
# Must be a build ARG, not a runtime env var — see docs/specs/architecture.md#compose--build-layout.
ARG GATEWAY_PUBLIC_URL=http://localhost:8000
ENV EXPO_PUBLIC_GATEWAY_ORIGIN=$GATEWAY_PUBLIC_URL
RUN npm run build:web

FROM caddy:2-alpine AS runner
COPY --from=builder /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
