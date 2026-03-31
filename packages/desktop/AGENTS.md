# @pv/desktop — Desktop App (Electrobun)

## Overview
Native desktop wrapper for the CR web dashboard. Uses Electrobun to run the
existing `@pv/server` + `@pv/web` stack inside a native window with system
webview.

## Architecture
- **Main process** (`src/bun/index.ts`): Starts an embedded `@pv/server` on an
  ephemeral port, opens a `BrowserWindow` pointing at `http://localhost:{port}`.
- **RPC** (`src/bun/rpc.ts` + `src/shared/rpc-types.ts`): Typed IPC between
  the main process and the webview — used only for desktop-native features
  (window state persistence, app version, native dialogs).
- **App state** (`src/bun/app-state.ts`): SQLite database at `~/.pv/desktop.db`
  persisting window geometry and user preferences.
- **Menus** (`src/bun/menus.ts`): Native application menu bar.

## Key Decisions
- The web app is loaded via URL (`http://localhost`), **not** bundled as a
  `views://` asset. This keeps the web bundle pipeline unchanged.
- Zero modifications to `@pv/web` or `@pv/server` — all desktop logic is
  isolated in this package.
- SQLite is used minimally for window state and preferences only.

## Build & Run
```bash
# From monorepo root
bun run desktop:dev          # Dev build + launch
bun run desktop:build        # Production build

# From packages/desktop/
bun run dev                  # Dev build + launch
bun run build:release        # Production build
```

## Style
- Follow root AGENTS.md conventions (strict TS, kebab-case files, camelCase
  functions, PascalCase types).
- Keep the main process entry small — delegate to focused modules.
