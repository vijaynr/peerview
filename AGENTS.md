# Repository Guidelines

## Project Structure & Module Organization
`cr-cli` is a TypeScript monorepo running on Bun with four packages under `packages/`:

| Package | Path | Role |
|---|---|---|
| `@cr/cli` | `packages/cli/` | Binary entrypoint, command handlers |
| `@cr/core` | `packages/core/` | Business logic, types, infrastructure (no UI) |
| `@cr/ui` | `packages/ui/` | All terminal rendering (colors, spinners, prompts, banners) |
| `@cr/workflows` | `packages/workflows/` | Stateless workflow implementations |

Each package has its own `AGENTS.md` with package-specific rules.

- `resources/prompts/` — prompt templates (`review.txt`, `summarize.txt`, `chat.txt`, `mr.txt`).
- `resources/assets/` — bundled assets (`banner.txt`).

## Build, Test, and Development Commands
- `bun install`: Install dependencies.
- `bun run help`: CLI smoke check.
- `bun run init`: Configure API and GitLab settings.
- `bun run review`: Run review workflow.
- `bun run create-mr`: Run create MR workflow.
- `bun run typecheck`: Run TypeScript typecheck (primary correctness guardrail).
- `bun run lint`: Run ESLint across all packages.
- `bun run build`: Typecheck and compile binary to `dist/cr`.
- `bash build.sh`: Build executable and platform tarball.

## Coding Style & Naming Conventions
- Strict TypeScript (`tsconfig` strict mode).
- 2-space indentation; semicolons optional — stay consistent with the file you're editing.
- Files and functions in `kebab-case` / `camelCase`; types/interfaces in `PascalCase`.
- Prefer focused helpers over large monolithic functions.

## Testing Guidelines
- Current guardrail is `bun run typecheck` + `bun run lint`.
- Add tests under a top-level `tests-ts/` directory if you introduce a test framework.
- For workflow changes, include at least one regression-oriented case.

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
