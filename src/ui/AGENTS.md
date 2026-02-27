# UI Layer Guidelines

## Scope

Applies to `src/ui/**` terminal rendering and prompts.

## Responsibilities

- Handle display, formatting, and interactive prompt flow.
- Keep business decisions outside UI modules.

## Conventions

- Keep output readable in narrow terminals.
- Reuse shared console/prompt helpers.
- Avoid network or git side effects from UI functions.

## Validation

- Run impacted CLI commands and verify terminal output paths manually.
