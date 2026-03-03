# @cr/workflows — Agent Guidelines

## Package Role
Stateless workflow implementations. Each workflow takes structured input and returns structured output; all UI interaction is injected via callbacks.

## Structure
- `src/index.ts` — public barrel export.
- `src/reviewWorkflow.ts` — full code-review workflow: fetches MR diff, runs LLM review, posts inline comments.
- `src/reviewSummarizeWorkflow.ts` — summarises a review result into a short paragraph.
- `src/reviewChatWorkflow.ts` — interactive Q&A over a review context using chat history.
- `src/createMrWorkflow.ts` — creates or updates a GitLab MR: generates description draft, handles feedback loop, upserts via API.

## Dependencies
- `@cr/core` — all types, clients, LLM helpers, GitLab helpers, workflow step runner.

## Key Rules
- No `console.log`, no `ora`, no ANSI — workflows are pure logic; UI is injected by the caller via `status`, `events`, and callback props on the input object.
- Workflows must be deterministic given the same inputs (side effects only through injected clients).
- All public exports must go through `src/index.ts`.
- Validate with `bun run typecheck` and `bun run lint` after changes.
