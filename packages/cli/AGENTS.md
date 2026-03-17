# @cr/cli — Agent Guidelines

## Package Role

Entry point for the `cr` binary. Parses CLI arguments and delegates to the appropriate command handler.

## Structure

- `src/cli.ts` — binary entrypoint; reads `argv` and dispatches to commands.
- `src/commands/index.ts` — command router; also handles `--show-banner`.
- `src/commands/initCommand.ts` — interactive setup/bootstrap flows for GitLab, GitHub, Review Board, SVN, webhook, SDD, and RPI.
- `src/commands/configCommand.ts` — prints config contents or opens `~/.cr.conf` in the user's editor.
- `src/commands/reviewCommand.ts` — routes review, summarize, and chat workflows across supported providers.
- `src/commands/createReviewCommand.ts` — generates GitLab merge request drafts or Review Board review requests.
- `src/commands/createMrCommand.ts` — compatibility wrapper that forwards to `create-review --gl`.
- `src/commands/serveCommand.ts` — starts the unified server for web and webhook routes.
- `src/commands/helpCommand.ts` — prints usage information.

## Dependencies

- `@cr/core` — config, git helpers, bootstrap.
- `@cr/tui` — all terminal output, prompts, spinners.
- `@cr/workflows` — workflow implementations.

## Key Rules

- No business logic here; all logic lives in `@cr/core` or `@cr/workflows`.
- All terminal output must go through `@cr/tui` — never use `console.log` directly in commands.
- Spinners must be created via `createSpinner` from `@cr/tui`, not `ora` directly.
- Keep command help text and the `printHelpView()` summary aligned when commands or workflows change.
- Prefer adding new command behavior behind dedicated handlers in `src/commands/` instead of extending `src/commands/index.ts` inline.
- Validate with `bun run typecheck` and `bun run lint` after changes.
