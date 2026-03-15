# CR CLI

CR CLI is a Bun + TypeScript command-line tool for GitLab merge request and GitHub pull request review workflows powered by LLMs.

## Features

- Review merge requests and pull requests (`review`)
- Summarize merge requests and pull requests (`review --workflow summarize`)
- Interactive MR/PR Q&A chat (`review --workflow chat`)
- Create or update merge requests and pull requests with AI-generated title/description (`review --workflow create`)
- Review and summarize local uncommitted changes via stdin diff (`--local`)
- Optional inline comments posting to GitLab and GitHub (`--inline-comments`)
- Auto-detect Git provider (GitHub or GitLab) based on remote URL
- Support for self-hosted GitLab instances

## Requirements

- [Bun](https://bun.sh/) 1.x
- Access to CR/OpenAI-compatible API
- GitLab token with `api` scope (for GitLab)
- GitHub Personal Access Token with `repo` scope (for GitHub)

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

For GitHub integration:

```bash
bun run init --github
```

For GitLab integration:

```bash
bun run init --gitlab
```

Configuration is stored at `~/.cr.conf`.

## Git Provider Auto-Detection

CR CLI automatically detects whether you're working with GitHub or GitLab based on your git remote URL:

- **GitHub**: Remotes like `git@github.com:owner/repo.git` or `https://github.com/owner/repo.git`
- **GitLab**: Remotes pointing to `gitlab.com` or containing `gitlab` in the URL
- **Self-hosted**: Use `--gitlab` or `--github` flags to override auto-detection

### Examples

```bash
# Auto-detect provider from git remote
cd /path/to/github-repo && cr review
cd /path/to/gitlab-repo && cr review

# Force specific provider
cr review --github --url https://github.com/owner/repo/pull/123
cr review --gitlab --url https://gitlab.com/owner/repo/-/merge_requests/456

# Review a specific pull request or merge request
cr review --url https://github.com/octocat/Hello-World/pull/1
cr review --url https://gitlab.example.com/group/project/-/merge_requests/2
```

## Usage

```bash
bun run help
bun run review -- --path .
bun run review -- --workflow summarize --path .
bun run review -- --workflow chat --path .
bun run review -- --workflow create --path . --target-branch main
bun run review -- --github --path . # Force GitHub provider
bun run review -- --gitlab --path . # Force GitLab provider
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

## Docker

Build the image:

```bash
docker build -t cr-webhook .
```

The image starts the webhook server by default via `cr serve --webhook`.

Run with Docker Compose:

```bash
docker compose up --build
```

Compose defaults to HTTP on port `3000`. You can switch to HTTPS by setting `CR_WEBHOOK_TLS_MODE=https` and mounting certs under `./docker/certs`.

Run over HTTP:

```bash
docker run --rm -p 3000:3000 \
  -e CR_WEBHOOK_TLS_MODE=http \
  -e GITLAB_URL=https://gitlab.example.com \
  -e GITLAB_KEY=your-token \
  cr-webhook
```

Run over HTTPS:

```bash
docker run --rm -p 3443:3000 \
  -e CR_WEBHOOK_TLS_MODE=https \
  -e SSL_CERT_PATH=/certs/tls.crt \
  -e SSL_KEY_PATH=/certs/tls.key \
  -e GITLAB_URL=https://gitlab.example.com \
  -e GITLAB_KEY=your-token \
  -v "$PWD/certs:/certs:ro" \
  cr-webhook
```

Supported container env vars:

- `CR_WEBHOOK_TLS_MODE=http|https|auto` chooses plain HTTP, strict HTTPS, or HTTPS when certs are present.
- `CR_WEBHOOK_PORT` sets the internal listen port. Default is `3000`.
- `CR_WEBHOOK_CONCURRENCY`, `CR_WEBHOOK_QUEUE_LIMIT`, `CR_WEBHOOK_TIMEOUT_MS` map to the webhook server flags.
- `SSL_CERT_PATH`, `SSL_KEY_PATH`, `SSL_CA_PATH` control TLS certificate loading.
- `GITLAB_URL`, `GITLAB_KEY` for GitLab integration.
- `GITHUB_TOKEN` for GitHub integration.
- `OPENAI_API_KEY` for LLM integration.

`auto` is the default mode. In that mode the container serves HTTPS when both `SSL_CERT_PATH` and `SSL_KEY_PATH` are present, otherwise it falls back to HTTP.

Example Compose `.env` for HTTP:

```dotenv
CR_WEBHOOK_TLS_MODE=http
WEBHOOK_HOST_PORT=3000
GITLAB_URL=https://gitlab.example.com
GITLAB_KEY=your-token
GITHUB_TOKEN=your-github-token
OPENAI_API_KEY=your-openai-key
```

Example Compose `.env` for HTTPS:

```dotenv
CR_WEBHOOK_TLS_MODE=https
WEBHOOK_HOST_PORT=3443
CR_WEBHOOK_PORT=3000
SSL_CERT_PATH=/certs/tls.crt
SSL_KEY_PATH=/certs/tls.key
GITLAB_URL=https://gitlab.example.com
GITLAB_KEY=your-token
GITHUB_TOKEN=your-github-token
OPENAI_API_KEY=your-openai-key
```

The container runs `cr serve --webhook`, exposing:

- `POST /gitlab` for GitLab webhook events
- `POST /github` for GitHub webhook events (future enhancement)
- `POST /reviewboard`
- `GET /status`

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
