import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tempRoot = path.join(
  os.tmpdir(),
  `cr-config-test-${Date.now()}-${Math.random().toString(16).slice(2)}`
);
const confPath = path.join(tempRoot, ".cr.conf");
const crDir = path.join(tempRoot, ".cr");
const keyPath = path.join(crDir, "config.key");

mock.module("../packages/core/src/utils/paths.js", () => ({
  HOME_DIR: tempRoot,
  CR_DIR: crDir,
  CR_PROMPTS_DIR: path.join(crDir, "prompts"),
  CR_ASSETS_DIR: path.join(crDir, "assets"),
  CR_LOGS_DIR: path.join(crDir, "logs"),
  CR_CONF_PATH: confPath,
  CR_CONF_KEY_PATH: keyPath,
  repoRootFromModule: () => tempRoot,
  resourcesPathFromRepoRoot: (repoRoot: string) => path.join(repoRoot, "resources"),
}));

const { decryptConfigSecret, encryptConfigSecret, loadCRConfig, saveCRConfig } = await import(
  "../packages/core/src/utils/config.js"
);

describe("config encryption", () => {
  beforeAll(async () => {
    await fs.mkdir(tempRoot, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("round-trips encrypted secrets", () => {
    const key = Buffer.alloc(32, 7);
    const encrypted = encryptConfigSecret("svn-pass", key);

    expect(encrypted.startsWith("enc:v1:")).toBe(true);
    expect(encrypted.includes("svn-pass")).toBe(false);
    expect(decryptConfigSecret(encrypted, key)).toBe("svn-pass");
  });

  it("stores secret fields encrypted on disk and decrypts them on load", async () => {
    await saveCRConfig({
      openaiApiUrl: "https://api.example.com/v1",
      openaiApiKey: "openai-key",
      openaiModel: "gpt-4o",
      useCustomStreaming: false,
      defaultReviewAgents: ["general", "security"],
      gitlabUrl: "https://gitlab.example.com",
      gitlabKey: "gitlab-key",
      githubToken: "github-token",
      svnRepositoryUrl: "https://svn.example.com/repos/project",
      svnUsername: "svn-user",
      svnPassword: "svn-pass",
      rbUrl: "https://reviews.example.com",
      rbToken: "rb-token",
      gitlabWebhookSecret: "gitlab-webhook-secret",
      githubWebhookSecret: "github-webhook-secret",
      rbWebhookSecret: "rb-webhook-secret",
      gitlabWebhookEnabled: false,
      githubWebhookEnabled: true,
      reviewboardWebhookEnabled: false,
    });

    const raw = await fs.readFile(confPath, "utf-8");
    expect(raw.includes("openai_api_key = openai-key")).toBe(false);
    expect(raw.includes("gitlab_key = gitlab-key")).toBe(false);
    expect(raw.includes("github_token = github-token")).toBe(false);
    expect(raw.includes("svn_password = svn-pass")).toBe(false);
    expect(raw.includes("rb_token = rb-token")).toBe(false);
    expect(raw.includes("gitlab_webhook_secret = gitlab-webhook-secret")).toBe(false);
    expect(raw.includes("github_webhook_secret = github-webhook-secret")).toBe(false);
    expect(raw.includes("rb_webhook_secret = rb-webhook-secret")).toBe(false);
    expect(raw.includes("openai_api_key_enc = enc:v1:")).toBe(true);
    expect(raw.includes("gitlab_key_enc = enc:v1:")).toBe(true);
    expect(raw.includes("github_token_enc = enc:v1:")).toBe(true);
    expect(raw.includes("svn_password_enc = enc:v1:")).toBe(true);
    expect(raw.includes("rb_token_enc = enc:v1:")).toBe(true);
    expect(raw.includes("gitlab_webhook_secret_enc = enc:v1:")).toBe(true);
    expect(raw.includes("github_webhook_secret_enc = enc:v1:")).toBe(true);
    expect(raw.includes("rb_webhook_secret_enc = enc:v1:")).toBe(true);
    expect(raw.includes("gitlab_webhook_enabled = false")).toBe(true);
    expect(raw.includes("github_webhook_enabled = true")).toBe(true);
    expect(raw.includes("reviewboard_webhook_enabled = false")).toBe(true);
    expect(raw.includes("default_review_agents = general,security")).toBe(true);

    const loaded = await loadCRConfig();
    expect(loaded.defaultReviewAgents).toEqual(["general", "security"]);
    expect(loaded.openaiApiKey).toBe("openai-key");
    expect(loaded.gitlabKey).toBe("gitlab-key");
    expect(loaded.githubToken).toBe("github-token");
    expect(loaded.svnPassword).toBe("svn-pass");
    expect(loaded.rbToken).toBe("rb-token");
    expect(loaded.gitlabWebhookSecret).toBe("gitlab-webhook-secret");
    expect(loaded.githubWebhookSecret).toBe("github-webhook-secret");
    expect(loaded.rbWebhookSecret).toBe("rb-webhook-secret");
    expect(loaded.gitlabWebhookEnabled).toBe(false);
    expect(loaded.githubWebhookEnabled).toBe(true);
    expect(loaded.reviewboardWebhookEnabled).toBe(false);
  });
});
