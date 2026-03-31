# @pv/web — Agent Guidelines

## Package Role

Browser-facing dashboard UI for CR plus the route helpers that serve it. Owns Lit components, the HTML shell, and the Bun bundling entrypoint used by `@pv/server`.

## Structure

- `src/index.ts` — HTML shell, bundled script generation, and Hono route creation for `/`, `/web`, and `/api/dashboard`.
- `src/app.ts` — browser entrypoint that registers the dashboard app.
- `src/components/` — Lit custom elements for the dashboard shell, provider cards, request items, and config summaries.
- `src/styles.ts` — shared theme tokens and reusable dashboard styles.
- `src/types.ts` — browser-side dashboard data contracts and provider ordering.

## Dependencies

- `lit` — custom elements and templating.
- `hono` — route helpers exported to `@pv/server`.

## Key Rules

- Keep this package browser-focused: presentation, custom elements, and asset bundling belong here; runtime config, provider API calls, and workflow logic belong elsewhere.
- Keep dashboard data contracts in `src/types.ts` aligned with the `/api/dashboard` response shape expected by `@pv/server` and produced from `@pv/core`.
- Reuse `dashboardThemeStyles` and component composition instead of duplicating layout/theme primitives across components.
- Keep fetch/network orchestration centralized in top-level app components unless a feature clearly needs a dedicated abstraction.
- Validate with `bun run typecheck` and `bun run lint`; run `bun run test` when dashboard routes or API contracts change.
