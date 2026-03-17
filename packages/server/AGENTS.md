# @cr/server — Agent Guidelines

## Package Role

HTTP/server surface for CR. Owns Hono route wiring, Bun server startup, webhook intake, and background queue orchestration. Review logic and provider behavior should stay in `@cr/workflows` and `@cr/core`.

## Structure

- `src/index.ts` — public exports and shared job types.
- `src/server.ts` — creates and starts the Bun/Hono server, mounts routes, and wires optional web/webhook features.
- `src/routes/status.ts` — status/health endpoints.
- `src/routes/api.ts` — config, dashboard, and provider API routes.
- `src/routes/webhooks.ts` — webhook validation, parsing, and queue submission.
- `src/workQueue.ts` — bounded background work queue for webhook-triggered reviews.
- `src/types.ts` — server context and route-shared types.

## Dependencies

- `@cr/core` — runtime config, dashboard loading, provider helpers, and logging.
- `@cr/workflows` — review execution and comment-posting helpers.
- `@cr/web` — web dashboard HTML, script bundling, and route helpers.
- `hono` — HTTP routing.

## Key Rules

- Keep HTTP concerns here: request parsing, route composition, webhook auth/validation, and queue orchestration.
- Push provider and review business logic down into `@cr/core` or `@cr/workflows` instead of reimplementing it in route handlers.
- Prefer structured logging via `@cr/core`'s `logger`; if direct `console.*` output is kept for server lifecycle or webhook operations, keep it localized and operational.
- When changing API or dashboard payloads, update `@cr/web` consumers and relevant tests in the same change.
- Validate with `bun run typecheck` and `bun run lint`; run `bun run test` for route, webhook, or queue-behavior changes.
