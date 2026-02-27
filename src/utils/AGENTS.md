# Utilities Guidelines

## Scope

Applies to `src/utils/**`.

## Responsibilities

- Provide reusable helpers for config, git, gitlab, llm, markdown, prompts, and workflow runtime.
- Keep helper APIs small and deterministic.

## Conventions

- Prefer pure functions where possible.
- Isolate I/O boundaries and pass dependencies explicitly when practical.
- Keep workflow-event contracts synchronized with `src/types/workflows.ts`.

## Validation

- Run `bun run typecheck`.
- Run relevant integration tests when touching git/gitlab/llm helpers.
