# @cr/core — Agent Guidelines

## Package Role

Shared business logic, types, resource loading, and infrastructure utilities used by the CLI, workflows, and server. This package is UI-free: never import from `@cr/tui` or `@cr/web`.

## Structure

- `src/index.ts` — public barrel export for clients, types, resources, and utilities.
- `src/clients/` — runtime client factories and interfaces for GitHub, GitLab, Review Board, SVN, and LLM integrations.
- `src/types/` — shared TypeScript contracts for config, providers, workflows, and dashboard/web data.
- `src/resources/index.ts` — bundles prompts, templates, and text assets with Bun text imports.
- `src/utils/config.ts`, `paths.ts`, `bootstrap.ts` — config I/O, canonical paths, and `~/.cr` bootstrapping.
- `src/utils/git.ts`, `github.ts`, `gitlab.ts`, `reviewBoard.ts`, `svn.ts`, `svnWorkingCopy.ts` — SCM/provider helpers and transport utilities.
- `src/utils/dashboard.ts`, `repositoryGuidelines.ts`, `promptsManager.ts`, `specs.ts`, `rpi.ts` — higher-level resource loading and generated-content helpers.
- `src/utils/llm.ts`, `streamParser.ts`, `workflow.ts`, `workflowRuntime.ts` — streaming, workflow execution, and runtime configuration helpers.
- `src/utils/logger.ts`, `errors.ts`, `assertions.ts` — shared diagnostics and guardrails.

## Key Rules

- No TTY/UI concerns here: no `@cr/tui`, no `@cr/web`, no ANSI formatting, and no direct terminal rendering.
- Keep provider-specific HTTP/API logic in focused helpers or clients instead of duplicating calls in CLI, workflow, or server code.
- All public exports must go through `src/index.ts`.
- When changing bundled prompts/templates or config-path behavior, keep bootstrap/setup helpers and override lookup behavior in sync.
- Validate with `bun run typecheck` and `bun run lint`; run `bun run test` when shared behavior changes.
