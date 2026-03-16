# Repository Guidelines

## Project Structure & Module Organization

`cr-cli` is a TypeScript monorepo running on Bun with six packages under `packages/`:

| Package            | Path                     | Role                                                               |
| ------------------ | ------------------------ | ------------------------------------------------------------------ |
| `@cr/cli`          | `packages/cli/`          | Binary entrypoint and command handlers                             |
| `@cr/core`         | `packages/core/`         | Shared business logic, types, resource loading, and integrations   |
| `@cr/tui`          | `packages/tui/`          | Terminal rendering, prompts, spinners, banners, and help output    |
| `@cr/workflows`    | `packages/workflows/`    | Review, summarize, chat, MR creation, and Review Board workflows   |
| `@cr/reviewboard`  | `packages/reviewboard/`  | Review Board client/types adapter used by `@cr/core`               |
| `@cr/webhook`      | `packages/webhook/`      | Webhook server and work queue for automated review processing      |

Package-specific `AGENTS.md` files exist in `packages/cli`, `packages/core`, `packages/tui`, and `packages/workflows`. If a package has no local guide, follow this root file.

- `resources/prompts/` — bundled prompt templates (`review.txt`, `summarize.txt`, `chat.txt`, `mr.txt`).
- `resources/specs/templates/` — bundled spec templates (`prd.md`, `design.md`, `threat-model.md`, `refine.md`, `plan.md`, `doit.md`).
- `tests/` — Bun test suite for command and webhook behavior.

## Build, Test, and Development Commands

- `bun install`: Install dependencies.
- `bun run dev`: Run the CLI entrypoint directly.
- `bun run help`: CLI smoke check.
- `bun run init`: Configure API and GitLab settings.
- `bun run config`: View or edit saved configuration.
- `bun run review`: Run review workflow.
- `bun run create-mr`: Run create MR workflow.
- `bun run serve -- --webhook`: Start the webhook server.
- `bun run test`: Run the Bun test suite in `tests/`.
- `bun run typecheck`: Run TypeScript typecheck (primary correctness guardrail).
- `bun run lint`: Run ESLint across all packages.
- `bun run format`: Run Prettier across `packages/`.
- `bun run build`: Typecheck and compile binary to `dist/cr`.
- `bash build.sh`: Build executable and platform tarball.

## Coding Style & Naming Conventions

- Strict TypeScript (`tsconfig` strict mode).
- 2-space indentation; semicolons optional — stay consistent with the file you're editing.
- Files and functions in `kebab-case` / `camelCase`; types/interfaces in `PascalCase`.
- Prefer focused helpers over large monolithic functions.

## Testing Guidelines

- Primary guardrails are `bun run typecheck`, `bun run lint`, and `bun run test` when behavior changes.
- Keep automated tests under the top-level `tests/` directory using Bun's test runner.
- For workflow, CLI, or webhook changes, add or update at least one regression-oriented case when practical.

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
