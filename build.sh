#!/usr/bin/env bash
set -euo pipefail

if ! command -v bun >/dev/null 2>&1; then
  echo "Error: bun is required but not installed or not in PATH."
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
bun run typecheck
bun build --compile src/cli.ts --outfile "dist/$EXE_NAME"

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
