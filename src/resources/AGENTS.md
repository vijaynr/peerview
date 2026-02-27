# Source Resource Loader Guidelines

## Scope

Applies to `src/resources/**`.

## Responsibilities

- Provide typed access to bundled text/assets used by runtime code.
- Keep path resolution centralized and stable.

## Conventions

- Prefer explicit exports from `index.ts`.
- Avoid hardcoded absolute paths.
- Keep runtime fallbacks deterministic.

## Validation

- Run `bun run typecheck` and smoke-run `bun run help` if loader behavior changes.
