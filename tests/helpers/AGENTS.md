# Test Helper Guidelines

## Scope
Applies to `tests/helpers/**`.

## Responsibilities
- Provide reusable setup utilities (temp repos, CLI runners).

## Conventions
- Keep helpers generic and side-effect aware.
- Ensure cleanup is reliable to avoid cross-test contamination.
- Prefer explicit parameters over hidden global state.

## Validation
- Run tests that consume changed helpers.