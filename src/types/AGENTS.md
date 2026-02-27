# Types Guidelines

## Scope

Applies to `src/types/**`.

## Responsibilities

- Define shared contracts for config, workflows, and clients.
- Keep types framework-agnostic and side-effect free.

## Conventions

- Prefer precise types over `any`.
- Use `PascalCase` for exported interfaces/types.
- When changing public shapes, update all dependents in `commands`, `workflows`, and `utils`.

## Validation

- Run `bun run typecheck`.
