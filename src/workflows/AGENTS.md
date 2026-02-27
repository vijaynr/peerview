# Workflows Guidelines

## Scope

Applies to `src/workflows/**`.

## Responsibilities

- Coordinate end-to-end command behavior.
- Compose utilities/clients/ui without duplicating low-level logic.

## Conventions

- Keep each workflow focused on one user flow.
- Emit consistent workflow events and statuses.
- Prefer explicit step boundaries so failures are easy to diagnose.

## Validation

- Run `bun run review` or other impacted commands.
- Run integration tests under `tests/` for changed workflow paths.
