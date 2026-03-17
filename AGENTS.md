# Repository Guidelines

## Project Structure & Module Organization

`cr-cli` is a TypeScript monorepo running on Bun with nine packages under `packages/`:

| Package            | Path                     | Role                                                               |
| ------------------ | ------------------------ | ------------------------------------------------------------------ |
| `@cr/cli`          | `packages/cli/`          | Binary entrypoint and command handlers                             |
| `@cr/core`         | `packages/core/`         | Shared business logic, types, resource loading, and integrations   |
| `@cr/github`       | `packages/github/`       | GitHub API client/types adapter used by `@cr/core`                 |
| `@cr/gitlab`       | `packages/gitlab/`       | GitLab API client/types adapter used by `@cr/core`                 |
| `@cr/tui`          | `packages/tui/`          | Terminal rendering, prompts, spinners, banners, and help output    |
| `@cr/workflows`    | `packages/workflows/`    | Review, summarize, chat, MR/PR draft creation, and Review Board workflows |
| `@cr/reviewboard`  | `packages/reviewboard/`  | Review Board client/types adapter used by `@cr/core`               |
| `@cr/server`       | `packages/server/`       | Unified server for webhook endpoints, web shell, and API routes    |
| `@cr/web`          | `packages/web/`          | Lit dashboard UI and route helpers served by `@cr/server`          |

Package-specific `AGENTS.md` files exist in `packages/cli`, `packages/core`, `packages/tui`, `packages/workflows`, `packages/server`, and `packages/web`. If a package has no local guide, follow this root file.

- `resources/prompts/` — bundled prompt templates for review, summarize, chat, MR drafting, aggregate review synthesis, and review agents.
- `resources/specs/templates/` — bundled spec templates (`prd.md`, `design.md`, `threat-model.md`, `refine.md`, `plan.md`, `doit.md`).
- `resources/rpi/templates/` — bundled Research / Plan / Implement prompt templates used by `cr init --rpi`.
- `tests/` — Bun test suite for command and webhook behavior.

## Build, Test, and Development Commands

- `bun install`: Install dependencies.
- `bun run dev -- <command>`: Run the CLI entrypoint directly with any `cr` command.
- `bun run help`: CLI smoke check.
- `bun run init -- [--gitlab|--github|--reviewboard|--subversion|--webhook|--sdd|--rpi]`: Run configuration/setup flows.
- `bun run review -- [flags]`: Run review workflows (`default`, `summarize`, `chat`) for GitLab, GitHub, local diffs, or Review Board where supported.
- `bun run create-review -- [flags]`: Generate or update a GitLab merge request draft or Review Board review request from local changes.
- `bun run create-mr`: Run create MR workflow.
- `bun run dev -- config [--edit]`: Print the saved config or open it in `$CR_EDITOR` / `$VISUAL` / `$EDITOR`.
- `bun run dev -- serve [flags]`: Start the unified server for the web app, APIs, and webhook endpoints.
- `bun run test`: Run the Bun test suite in `tests/`.
- `bun run typecheck`: Run TypeScript typecheck (primary correctness guardrail).
- `bun run lint`: Run Biome lint across `packages/` and `tests/`.
- `bun run lint:fix`: Apply Biome lint fixes where possible.
- `bun run format`: Run Biome format across `packages/` and `tests/`.
- `bun run format:check`: Check formatting without writing changes.
- `bun run build:bin`: Compile the binary to `dist/cr`.
- `bun run build:bin-compress`: Compile the binary and attempt optional UPX compression.
- `bun run build`: Typecheck and compile binary to `dist/cr`.
- `bash build.sh`: Build executable and platform tarball.

## Coding Style & Naming Conventions

- Strict TypeScript (`tsconfig` strict mode).
- 2-space indentation; semicolons optional — stay consistent with the file you're editing.
- Files and functions in `kebab-case` / `camelCase`; types/interfaces in `PascalCase`.
- Prefer focused helpers over large monolithic functions.
- Preserve package boundaries: CLI wiring in `@cr/cli`, terminal output in `@cr/tui`, shared logic in `@cr/core`, workflows in `@cr/workflows`, HTTP/server orchestration in `@cr/server`, and browser UI in `@cr/web`.

## Testing Guidelines

- Primary guardrails are `bun run typecheck`, `bun run lint`, and `bun run test` when behavior changes.
- Keep automated tests under the top-level `tests/` directory using Bun's test runner.
- For workflow, CLI, or webhook changes, add or update at least one regression-oriented case when practical.
- When command help, workflow routing, or provider selection changes, prefer tests that exercise the affected command path.

## Commit & Pull Request Guidelines

- Use Conventional Commit prefixes: `feat:`, `fix:`, `refactor:`, `chore:`.
- Keep commit titles imperative and scoped.
- PRs should include:
  - concise problem/solution summary,
  - related issue/MR link,
  - validation evidence (`bun run typecheck`, `bun run lint`, command output snippets),
  - screenshots/terminal snippets for UX-visible changes.

## Security & Configuration Tips

- Never commit secrets.
- Runtime config is stored at `~/.cr.conf`.
- Prompt overrides are loaded from `~/.cr/prompts`.
- Spec template overrides and generated spec content live under `~/.cr/specs`.
