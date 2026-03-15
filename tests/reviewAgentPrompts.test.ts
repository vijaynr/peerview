import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tempRoot = path.join(
  os.tmpdir(),
  `cr-prompts-test-${Date.now()}-${Math.random().toString(16).slice(2)}`
);
const crDir = path.join(tempRoot, ".cr");
const promptsDir = path.join(crDir, "prompts");

mock.module("../packages/core/src/utils/paths.js", () => ({
  HOME_DIR: tempRoot,
  CR_DIR: crDir,
  CR_PROMPTS_DIR: promptsDir,
  CR_ASSETS_DIR: path.join(crDir, "assets"),
  CR_LOGS_DIR: path.join(crDir, "logs"),
  CR_CONF_PATH: path.join(tempRoot, ".cr.conf"),
  CR_CONF_KEY_PATH: path.join(crDir, "config.key"),
  repoRootFromModule: () => tempRoot,
  resourcesPathFromRepoRoot: (repoRoot: string) => path.join(repoRoot, "resources"),
}));

const {
  DEFAULT_REVIEW_AGENT_NAME,
  listBundledReviewAgentNames,
  loadReviewAgentPrompt,
  normalizeReviewAgentNames,
} = await import("../packages/core/src/utils/promptsManager.js");

describe("review agent prompts", () => {
  beforeAll(async () => {
    await fs.mkdir(path.join(promptsDir, "review-agents"), { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("loads bundled review agent prompts", async () => {
    const agents = listBundledReviewAgentNames();

    expect(agents).toEqual(["clean-code", "general", "performance", "security", "test-quality"]);

    const prompt = await loadReviewAgentPrompt("security", tempRoot);
    expect(prompt).toContain("security reviewer agent");
  });

  it("prefers user overrides for review agent prompts", async () => {
    const overridePath = path.join(promptsDir, "review-agents", "security.txt");
    await fs.writeFile(overridePath, "custom security prompt", "utf-8");

    const prompt = await loadReviewAgentPrompt("security", tempRoot);
    expect(prompt).toBe("custom security prompt");
  });

  it("normalizes and defaults review agent names", () => {
    expect(normalizeReviewAgentNames([" Security ", "general", "security"])).toEqual([
      "security",
      "general",
    ]);
    expect(normalizeReviewAgentNames()).toEqual([DEFAULT_REVIEW_AGENT_NAME]);
  });
});
