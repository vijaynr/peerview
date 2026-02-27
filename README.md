# CR CLI

CR CLI is a Bun + TypeScript command-line tool for GitLab merge request review workflows powered by LLMs.

## Features

- Review merge requests (`review`)
- Summarize merge requests (`review --workflow summarize`)
- Interactive MR Q&A chat (`review --workflow chat`)
- Create or update merge requests with AI-generated title/description (`review --workflow create`)
- Review and summarize local uncommitted changes via stdin diff (`--local`)
- Optional inline comments posting to GitLab (`--inline-comments`)

## Requirements

- [Bun](https://bun.sh/) 1.x
- Access to CR/OpenAI-compatible API
- GitLab token with `api` scope

## Installation

### Option 1: Manual Installation (Recommended)

**Windows:**
```powershell
# 1. Create install directory
New-Item -ItemType Directory -Force -Path "$env:LOCALAPPDATA\cr\bin"

# 2. Copy cr.exe to install directory
Copy-Item cr.exe "$env:LOCALAPPDATA\cr\bin\cr.exe"

# 3. Add to PATH (run as user, not admin)
# Open "Edit environment variables for your account"
# - Find "Path" variable and click Edit
# - Click New and add: %LOCALAPPDATA%\cr\bin
# - Click OK to save

# 4. Restart terminal and verify
cr help
```

**Linux/macOS:**
```bash
# 1. Create install directory
mkdir -p ~/.local/bin

# 2. Copy cr binary
cp cr ~/.local/bin/cr
chmod +x ~/.local/bin/cr

# 3. Add to PATH (if not already)
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc  # or ~/.zshrc
source ~/.bashrc  # or source ~/.zshrc

# 4. Verify
cr help
```

### Option 2: Automated Install Script

**⚠️ CAUTION:** Review the script before running. The automated scripts modify your PATH.

**Windows:**
```cmd
install.cmd
```

**Linux/macOS:**
```bash
bash install.sh
```

### Uninstall

**Windows:**
```powershell
# Remove binary
Remove-Item "$env:LOCALAPPDATA\cr\bin\cr.exe"

# Remove from PATH
# Open "Edit environment variables for your account"
# - Find "Path" variable and click Edit
# - Select %LOCALAPPDATA%\cr\bin and click Delete
# - Click OK
```

**Linux/macOS:**
```bash
# Remove binary
rm ~/.local/bin/cr

# Remove from PATH (if added by install script)
# Edit ~/.bashrc or ~/.zshrc and remove the line:
# export PATH="$HOME/.local/bin:$PATH"
```

## Development Setup

For development:

```bash
bun install
```

## Configuration

Run once:

```bash
bun run init
```

Configuration is stored at `~/.cr.conf`.

## Usage

```bash
bun run help
bun run review -- --path .
bun run review -- --workflow summarize --path .
bun run review -- --workflow chat --path .
bun run review -- --workflow create --path . --target-branch main
git diff | bun run review -- --local
git diff | bun run review -- --workflow summarize --local
```

## Build Binary

```bash
bun run build
```

Output:
- `dist/cr` (Linux/macOS)
- `dist/cr.exe` (Windows, when built on Windows)

You can also use:

```bash
bash build.sh
```

This creates a platform bundle `cr-cli-<platform>.tar.gz` with binary + usage/install scripts.

## Docker Linux Build

```bash
docker build -f Dockerfile.linux-build --target artifact --output type=local,dest=./docker-dist .
```

## Project Layout

- `src/cli.ts`: entrypoint
- `src/commands/`: command handlers
- `src/workflows/`: workflow logic
- `src/utils/`: integrations/helpers
- `src/ui/`: terminal rendering/progress
- `resources/prompts/`: prompt templates
- `resources/assets/banner.txt`: banner text

## Validation

```bash
bun run typecheck
```
