# @cr/core — Agent Guidelines

## Package Role
Pure business logic, shared types, and infrastructure utilities. Has no UI dependencies — never import from `@cr/ui`.

## Structure
- `src/index.ts` — public barrel export.
- `src/types/` — shared TypeScript types (`config`, `gitlab`, `llm`, `workflows`).
- `src/clients/` — factory functions for `GitLabClient` and `LlmClient`.
- `src/resources/index.ts` — bundles prompt templates and assets (e.g. `banner.txt`) via `with { type: "text" }` imports.
- `src/utils/`
  - `config.ts` — load/save `~/.cr.conf`.
  - `paths.ts` — canonical paths (`CR_DIR`, `CR_PROMPTS_DIR`, `CR_ASSETS_DIR`, `CR_LOGS_DIR`).
  - `bootstrap.ts` — `initializeCRHome`: creates `~/.cr/` directories and writes bundled files.
  - `git.ts` — `getCurrentBranch`, `getOriginRemoteUrl`.
  - `gitlab.ts` — GitLab REST helpers (MRs, branches, comments, diffs).
  - `llm.ts` — `generateTextWithLlm` streaming helper.
  - `streamParser.ts` — custom SSE stream parser.
  - `markdown.ts` — `renderMarkdownForTerminal`.
  - `promptsManager.ts` — `loadPrompt` (user override → bundled fallback).
  - `workflow.ts` — `runWorkflow` / `runSequentialWorkflow` step runners.
  - `workflowEvents.ts` — `createWorkflowPhaseReporter`.
  - `workflowRuntime.ts` — `loadWorkflowRuntime`.
  - `reviewWorkflowHelper.ts` — MR context injection, diff parsing, inline position resolution.
  - `reviewCommandHelper.ts` — CLI flag helpers, stdin diff reader, result formatters.
  - `errors.ts` — `formatKnownNetworkError`.
  - `logger.ts` — structured file logger.
  - `assertions.ts` — `assert` utility.

## Key Rules
- No `ora`, no ANSI codes, no `process.stdout` — this package must be UI-free.
- Spinner logic was intentionally removed from this package; it lives in `@cr/ui`.
- All public exports must go through `src/index.ts`.
- Validate with `bun run typecheck` and `bun run lint` after changes.
