# @cr/ui — Agent Guidelines

## Package Role
All terminal rendering: colors, borders, spinners, prompts, banners, live workflow progress. No business logic.

## Structure
- `src/index.ts` — public barrel export.
- `src/constants.ts` — `COLORS` (dark/light adaptive), `BANNER_COLOR`, `DOT`, `BORDERS`. Theme is auto-detected from env/config at import time.
- `src/banner.ts` — `BANNER_TEXT` (full ASCII art logo) and `BANNER_LOGO` (small icon). Single source of truth for the banner assets.
- `src/spinner.ts` — `createSpinner(text)` wrapping `ora` with the `aesthetic` style. Also exports `OraSpinner` type. **This is the only file that imports `ora` directly.**
- `src/console.ts` — all `console.log` output helpers:
  - `printHeaderBox()` — renders `BANNER_LOGO` + title/desc/version inside a bordered box.
  - `printBanner()` — animated full ASCII art banner (`BANNER_TEXT`) with binary scramble effect.
  - `printError`, `printSuccess`, `printWarning`, `printDivider`, `printReviewSummary`, `printChatAnswer`.
- `src/prompt.ts` — `promptWithFrame` (wraps `prompts` library), `askForOptionalFeedback`.
- `src/main.ts` — live workflow rendering:
  - `LiveController` — event emitter for streaming workflow status events.
  - `createWorkflowStatusController` — ties spinner lifecycle to workflow phase events.
  - `runLiveTask`, `runLiveChatLoop`, `runLiveCreateMrTask` — top-level task runners used by commands.

## Key Rules
- `ora` must only be imported in `spinner.ts`. Everywhere else use `createSpinner` / `OraSpinner`.
- Colors must always come from `COLORS` / `BANNER_COLOR` in `constants.ts` — no raw ANSI strings elsewhere.
- `BANNER_TEXT` and `BANNER_LOGO` must always be sourced from `banner.ts` — not re-loaded from disk or `bundledAssets` elsewhere.
- Validate with `bun run typecheck` and `bun run lint` after changes.
