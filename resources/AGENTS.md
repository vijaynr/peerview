# Resources Guidelines

## Scope
Applies to `resources/**` bundled non-code assets.

## Responsibilities
- Store prompt templates and static terminal assets.
- Keep files text-based and portable.

## Conventions
- Treat prompt edits as behavior changes requiring regression validation.
- Keep asset file names stable; update loaders if renaming.

## Validation
- For prompt changes, run impacted workflow command(s) and related integration tests.