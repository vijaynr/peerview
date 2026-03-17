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

COPY --from=build /app/dist/cr /usr/local/bin/cr
COPY docker/entrypoint.sh /usr/local/bin/cr-server-entrypoint

RUN sed -i 's/\r$//' /usr/local/bin/cr-server-entrypoint \
  && chmod +x /usr/local/bin/cr /usr/local/bin/cr-server-entrypoint

ENV CR_WEBHOOK_PORT=3000
ENV CR_WEBHOOK_TLS_MODE=auto

EXPOSE 3000

ENTRYPOINT ["sh", "/usr/local/bin/cr-server-entrypoint"]
