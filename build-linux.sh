#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-./docker-dist}"

if ! command -v docker >/dev/null 2>&1; then
    echo "Error: docker is required but not installed or not in PATH."
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

mkdir -p "$OUT_DIR"

echo "Building Linux executable with Docker..."
docker build \
    -f Dockerfile.linux-build \
    --target artifact \
    --output "type=local,dest=$OUT_DIR" \
    .

echo "Build complete. Artifacts written to: $OUT_DIR"
