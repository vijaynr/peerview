#!/bin/bash
# Pre-commit hook for CR-CLI
# Runs typecheck and lint before allowing commits
# 
# To use, copy this file to .git/hooks/pre-commit and make it executable:
#   chmod +x .git/hooks/pre-commit

set -e

echo "🔍 Running pre-commit checks..."

# Run typecheck
echo "📝 Checking TypeScript types..."
bun run typecheck

# Run linting (non-blocking warnings)
echo "🎨 Checking code style..."
bun run lint --max-warnings 10 || echo "⚠️  Lint warnings found (non-blocking)"

echo "✅ Pre-commit checks passed!"
