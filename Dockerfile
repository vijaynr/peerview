FROM oven/bun:1 AS build

WORKDIR /app

COPY package.json bun.lock tsconfig.json eslint.config.js .prettierrc ./
COPY AGENTS.md USAGE.txt build.sh README.md ./
COPY packages ./packages
COPY resources ./resources

RUN bun install --frozen-lockfile
RUN bun run build

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/dist/pv /usr/local/bin/pv
COPY docker/entrypoint.sh /usr/local/bin/pv-server-entrypoint

RUN sed -i 's/\r$//' /usr/local/bin/pv-server-entrypoint \
  && chmod +x /usr/local/bin/pv /usr/local/bin/pv-server-entrypoint

ENV PV_WEBHOOK_PORT=3000
ENV PV_WEBHOOK_TLS_MODE=auto

EXPOSE 3000

ENTRYPOINT ["sh", "/usr/local/bin/pv-server-entrypoint"]
