# syntax=docker/dockerfile:1
# Um Dockerfile para os 4 serviços: `--build-arg SERVICE=<gateway|pedidos|pagamentos|estoque>`.
# Multi-stage: dependências de produção separadas da imagem final (enxuta, sem npm cache).

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-alpine AS runtime
ARG SERVICE
ARG PORT=8080
ARG VERSION=dev
LABEL org.opencontainers.image.title="loja-veloz-${SERVICE}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.vendor="Loja Veloz"
ENV NODE_ENV=production SERVICE=${SERVICE} PORT=${PORT} APP_ENTRY=src/${SERVICE}/index.js
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src/shared ./src/shared
COPY src/${SERVICE} ./src/${SERVICE}
# Usuário não-root (uid 1000, já existe na imagem node)
USER node
EXPOSE ${PORT}
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1
# exec garante que o node seja PID 1 e receba SIGTERM (encerramento gracioso)
CMD ["sh", "-c", "exec node -r ./src/shared/tracing.js ${APP_ENTRY}"]
