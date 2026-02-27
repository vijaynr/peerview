# Mock Server Guidelines

## Scope
Applies to `tests/mockservers/**`.

## Responsibilities
- Simulate GitLab and LLM APIs for integration tests.

## Conventions
- Keep mocked responses stable and versioned by test intent.
- Expose only endpoints used by current tests.
- Log enough context to debug failing expectations quickly.

## Validation
- Run integration tests that depend on mocked server behavior.