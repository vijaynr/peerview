# @cr/cli — Agent Guidelines

## Package Role

Entry point for the `cr` binary. Parses CLI arguments and delegates to the appropriate command handler.

## Structure

- `src/cli.ts` — binary entrypoint; reads `argv` and dispatches to commands.
- `src/cliHelpers.ts` — shared CLI-only helpers for parsing and command setup.
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
- `@cr/server` — server startup used by `serve`.

## Key Rules

- Keep this package thin: argument parsing, command routing, and CLI glue belong here; reusable business logic belongs in `@cr/core`, `@cr/workflows`, or `@cr/server`.
- Prefer `@cr/tui` for user-facing terminal output and prompts. If a direct `console.*` call is necessary for a narrow bootstrap or fatal-error path, keep it minimal and localized.
- Spinners must be created via `createSpinner` from `@cr/tui`, not `ora` directly.
- Keep command help text, aliases, and the `printHelpView()` summary aligned when commands or workflows change.
- Prefer adding new behavior in dedicated files under `src/commands/` instead of expanding `src/commands/index.ts` inline.
- Validate with `bun run typecheck` and `bun run lint`; run `bun run test` when command routing, help output, or serve behavior changes.
