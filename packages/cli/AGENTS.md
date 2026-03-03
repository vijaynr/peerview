# @cr/cli — Agent Guidelines

## Package Role
Entry point for the `cr` binary. Parses CLI arguments and delegates to the appropriate command handler.

## Structure
- `src/cli.ts` — binary entrypoint; reads `argv` and dispatches to commands.
- `src/commands/index.ts` — command router; also handles `--show-banner`.
- `src/commands/initCommand.ts` — interactive setup wizard (API key, GitLab URL, theme, etc.).
- `src/commands/reviewCommand.ts` — triggers the code-review workflow.
- `src/commands/createMrCommand.ts` — triggers the merge-request creation workflow.
- `src/commands/helpCommand.ts` — prints usage information.

## Dependencies
- `@cr/core` — config, git helpers, bootstrap.
- `@cr/ui` — all terminal output, prompts, spinners.
- `@cr/workflows` — workflow implementations.

## Key Rules
- No business logic here; all logic lives in `@cr/core` or `@cr/workflows`.
- All terminal output must go through `@cr/ui` — never use `console.log` directly in commands.
- Spinners must be created via `createSpinner` from `@cr/ui`, not `ora` directly.
- Validate with `bun run typecheck` and `bun run lint` after changes.
