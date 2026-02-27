# Client Layer Guidelines

## Scope

Applies to `src/clients/**`.

## Responsibilities

- Encapsulate external service calls (GitLab, LLM providers).
- Keep transport/auth concerns here; avoid CLI formatting and workflow orchestration.
- Return typed, predictable results and normalize provider-specific fields.

## Implementation Notes

- Reuse shared types from `src/types`.
- Bubble errors with actionable context; do not swallow failures.
- Keep retry/timeout behavior explicit and testable.

## Validation

- Run `bun run typecheck` and relevant integration tests in `tests/` when behavior changes.
