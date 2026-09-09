# Build context is backend/ (the Nest monorepo root), same as every other app here.
#   docker build -f apps/telegram/Dockerfile -t personal-copilot-telegram .
# devops/telegram/docker-compose.yml sets context/dockerfile for you.

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build:telegram

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist/apps/telegram ./dist/apps/telegram
COPY --from=builder /app/dist/libs ./dist/libs

# Internal-only — never published to the host. No inbound webhook either: this service reaches
# Telegram via outbound long-polling, so it needs no public surface at all.
CMD ["node", "dist/apps/telegram/src/main.js"]
