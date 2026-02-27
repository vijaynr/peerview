# Test Suite Guidelines

## Scope
Applies to `tests/**` integration and helper infrastructure.

## Responsibilities
- Validate CLI behavior, workflow regressions, and mocked service interactions.

## Conventions
- Prefer deterministic tests with isolated temp repos and mock servers.
- Keep assertions user-observable (stdout/stderr, exit codes, side effects).
- Add regression coverage for workflow and prompt-affecting changes.

## Validation
- Run `bun test` for full suite when changing test infra.
- Run targeted test files during iteration for faster feedback.