import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import { createTempGitRepo } from "./helpers/temp-repo";
import { runCli } from "./helpers/run-cli";
import { startMockGitLabServer } from "./mockservers/mock-gitlab-server";
import { startMockLlmServer } from "./mockservers/mock-llm-server";

describe("integration/review-summarize-ci", () => {
  test("should summarize merge request in ci mode when GitLab and LLM mocks are available", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    const gitlab = startMockGitLabServer({ branch: repo.branch, hasOpenMr: true });
    const llm = startMockLlmServer({ answerText: "Integration summary from mock LLM." });

    try {
      const result = await runCli(
        ["review", "--workflow", "summarize", "--mode", "ci", "--path", repo.repoPath],
        {
          GITLAB_URL: gitlab.baseUrl,
          GITLAB_KEY: "gitlab-test-token",
          OPENAI_API_URL: llm.baseUrl,
          OPENAI_API_KEY: "llm-test-token",
          OPENAI_MODEL: "mock-model",
          HOME: tempHome,
          USERPROFILE: tempHome,
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Integration summary from mock LLM.");
      expect(gitlab.requests.length).toBeGreaterThanOrEqual(4);
      expect(
        gitlab.requests.some((req) => req.path.endsWith("/merge_requests") && req.query.includes("source_branch=")),
      ).toBe(true);
      expect(llm.requests.length).toBe(1);
      expect(llm.requests[0]?.path).toBe("/chat/completions");
      expect(llm.requests[0]?.headers.get("authorization")).toBe("Bearer llm-test-token");
    } finally {
      gitlab.stop();
      llm.stop();
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  test("should fail when no open merge request matches current branch", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    const gitlab = startMockGitLabServer({ branch: repo.branch, hasOpenMr: false });
    const llm = startMockLlmServer();

    try {
      const result = await runCli(
        ["review", "--workflow", "summarize", "--mode", "ci", "--path", repo.repoPath],
        {
          GITLAB_URL: gitlab.baseUrl,
          GITLAB_KEY: "gitlab-test-token",
          OPENAI_API_URL: llm.baseUrl,
          OPENAI_API_KEY: "llm-test-token",
          OPENAI_MODEL: "mock-model",
          HOME: tempHome,
          USERPROFILE: tempHome,
        },
      );

      expect(result.exitCode).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain("No open merge request found");
      expect(llm.requests.length).toBe(0);
    } finally {
      gitlab.stop();
      llm.stop();
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });
});
