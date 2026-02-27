# Repository Guidelines

## Project Structure & Module Organization
`cr-cli` is a TypeScript CLI project running on Bun.
- `src/cli.ts`: CLI entrypoint.
- `src/commands/`: Command handlers (`init`, `review`, `create-mr`, `help`).
- `src/workflows/`: Workflow implementations.
- `src/utils/`: GitLab, git, config, LLM, markdown, spinner helpers.
- `src/ui/`: Terminal output and live progress utilities.
- `src/types/`: Shared TS types.
- `resources/prompts/`: Prompt templates (`review.txt`, `summarize.txt`, `chat.txt`, `mr.txt`).
- `resources/assets/banner.txt`: CLI banner.

## Build, Test, and Development Commands
- `bun install`: Install dependencies.
- `bun run help`: CLI smoke check.
- `bun run init`: Configure API and GitLab settings.
- `bun run review`: Run review workflow.
- `bun run create-mr`: Run create MR workflow.
- `bun run typecheck`: Run TypeScript typecheck.
- `bun run build`: Typecheck and compile binary to `dist/cr`.
- `bash build.sh`: Build executable and platform tarball.

## Coding Style & Naming Conventions
- Strict TypeScript (`tsconfig` strict mode).
- 2-space indentation and semicolons are optional; stay consistent with existing files.
- Keep files and functions in `kebab-case` / `camelCase`; types/interfaces in `PascalCase`.
- Prefer focused helpers over large monolithic functions.

## Testing Guidelines
- Current guardrail is `bun run typecheck`.
- Add tests under a top-level `tests-ts/` directory if you introduce a test framework.
- For workflow changes, include at least one regression-oriented case.

## Commit & Pull Request Guidelines
- Use Conventional Commit prefixes: `feat:`, `fix:`, `refactor:`, `chore:`.
- Keep commit titles imperative and scoped.
- PRs should include:
  - concise problem/solution summary,
  - related issue/MR link,
  - validation evidence (`bun run typecheck`, command output snippets),
  - screenshots/terminal snippets for UX-visible changes.

## Security & Configuration Tips
- Never commit secrets.
- Runtime config is stored at `~/.cr.conf`.
- Prompt overrides are loaded from `~/.cr/prompts`.
