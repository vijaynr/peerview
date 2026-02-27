# Command Layer Guidelines

## Scope

Applies to `src/commands/**`.

## Responsibilities

- Define command entrypoints and argument handling.
- Delegate core logic to workflows/utilities.
- Keep commands thin: parse -> validate -> call workflow -> render result.

## Conventions

- Export command handlers from `index.ts`.
- Keep user-facing help/error text consistent with `help` command behavior.
- Do not embed heavy business logic directly in handlers.

## Validation

- Run `bun run help` and any changed command path (`bun run review`, `bun run init`, etc.).
