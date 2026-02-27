# Source Tree Guidelines

## Scope

Applies to `src/**` runtime TypeScript code.

## Architecture

- Keep `src/cli.ts` as thin orchestration.
- Route command parsing and entry behavior through `src/commands`.
- Keep business flows in `src/workflows` and reusable primitives in `src/utils`.
- Put terminal interaction code in `src/ui`.
- Keep API wrappers in `src/clients` and shared contracts in `src/types`.

## Edit Rules

- Prefer small, focused modules over broad cross-cutting edits.
- Avoid circular imports between `commands`, `workflows`, and `utils`.
- Keep side effects near command/workflow boundaries.

## Validation

- Run `bun run typecheck` after changing files in this tree.
