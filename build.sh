#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v bun >/dev/null 2>&1; then
  echo "Error: bun is required but not installed or not in PATH."
  exit 1
fi

TSC_BIN="./node_modules/.bin/tsc"
CLI_ENTRYPOINT="packages/cli/src/cli.ts"

if [[ ! -f "$CLI_ENTRYPOINT" ]]; then
  echo "Error: CLI entrypoint not found at $CLI_ENTRYPOINT."
  exit 1
fi

rm -rf dist
mkdir -p dist

UNAME_OUT="$(uname -s)"
EXE_NAME="cr"
PLATFORM="unknown"
if [[ "$UNAME_OUT" == Linux* ]]; then
  PLATFORM="linux"
elif [[ "$UNAME_OUT" == Darwin* ]]; then
  PLATFORM="macos"
elif [[ "$UNAME_OUT" == MINGW* || "$UNAME_OUT" == CYGWIN* || "$UNAME_OUT" == MSYS* || $(uname -o 2>/dev/null) == *Windows* ]]; then
  EXE_NAME="cr.exe"
  PLATFORM="windows"
fi

bun install

if [[ -x "$TSC_BIN" ]]; then
  "$TSC_BIN" --noEmit
elif [[ -f "$TSC_BIN.exe" ]]; then
  "${TSC_BIN}.exe" --noEmit
else
  echo "Error: local TypeScript binary not found. Run 'bun install' and try again."
  exit 1
fi

bun run build:web-bundle
bun build --compile --minify "$CLI_ENTRYPOINT" --outfile "dist/$EXE_NAME"

cp USAGE.txt dist/
cp install.sh dist/
cp install.cmd dist/
(
  cd dist
  tar -czf "../cr-cli-${PLATFORM}.tar.gz" "$EXE_NAME" USAGE.txt install.sh install.cmd
)
rm -f dist/USAGE.txt dist/install.sh dist/install.cmd

echo "Build complete."
echo "- Executable: dist/$EXE_NAME"
echo "- Bundle: cr-cli-${PLATFORM}.tar.gz"
