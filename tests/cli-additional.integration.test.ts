import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { describe, expect, test } from "bun:test";
import { createTempGitRepo } from "./helpers/temp-repo";
import { runCli } from "./helpers/run-cli";
import { startMockGitLabServer } from "./mockservers/mock-gitlab-server";
import { startMockLlmServer } from "./mockservers/mock-llm-server";

function envForServices(args: {
  tempHome: string;
  gitlabUrl?: string;
  llmUrl?: string;
}): Record<string, string> {
  const env: Record<string, string> = {
    HOME: args.tempHome,
    USERPROFILE: args.tempHome,
  };
  if (args.gitlabUrl) {
    env.GITLAB_URL = args.gitlabUrl;
    env.GITLAB_KEY = "gitlab-test-token";
  }
  if (args.llmUrl) {
    env.OPENAI_API_URL = args.llmUrl;
    env.OPENAI_API_KEY = "llm-test-token";
    env.OPENAI_MODEL = "mock-model";
  }
  return env;
}

describe("integration/cli-additional", () => {
  test("should print command list when help command is invoked", async () => {
    const result = await runCli(["help"], {});
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("COMMANDS");
    expect(result.stdout).toContain("cr review");
  });

  test("should exit non-zero when unknown command is invoked", async () => {
    const result = await runCli(["does-not-exist"], {});
    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Unknown command: does-not-exist");
  });

  test("should fail remote summarize when OPENAI config is missing", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    try {
      const result = await runCli(
        ["review", "--workflow", "summarize", "--mode", "ci", "--path", repo.repoPath],
        envForServices({ tempHome }),
      );
      expect(result.exitCode).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain("Missing LLM configuration");
    } finally {
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  test("should fail remote summarize when GitLab config is missing", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    const llm = startMockLlmServer({ answerText: "unused" });
    try {
      const result = await runCli(
        ["review", "--workflow", "summarize", "--mode", "ci", "--path", repo.repoPath],
        envForServices({ tempHome, llmUrl: llm.baseUrl }),
      );
      expect(result.exitCode).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain("Missing GitLab configuration");
    } finally {
      llm.stop();
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  test("should surface GitLab API errors during remote summarize", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    const llm = startMockLlmServer({ answerText: "unused" });
    const badGitLab = Bun.serve({
      port: 0,
      fetch() {
        return new Response("unauthorized", { status: 401 });
      },
    });
    try {
      const result = await runCli(
        ["review", "--workflow", "summarize", "--mode", "ci", "--path", repo.repoPath],
        envForServices({
          tempHome,
          gitlabUrl: `http://127.0.0.1:${badGitLab.port}`,
          llmUrl: llm.baseUrl,
        }),
      );
      expect(result.exitCode).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain("GitLab API 401");
    } finally {
      badGitLab.stop(true);
      llm.stop();
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  test("should surface LLM API errors during remote summarize", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    const gitlab = startMockGitLabServer({ branch: repo.branch, hasOpenMr: true });
    const llm = startMockLlmServer({ statusCode: 500, rawBody: "llm down" });
    try {
      const result = await runCli(
        ["review", "--workflow", "summarize", "--mode", "ci", "--path", repo.repoPath],
        envForServices({ tempHome, gitlabUrl: gitlab.baseUrl, llmUrl: llm.baseUrl }),
      );
      expect(result.exitCode).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain("API call failed: 500");
    } finally {
      gitlab.stop();
      llm.stop();
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  test("should use fallback MR draft when LLM generation fails in create workflow", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    const gitlab = startMockGitLabServer({
      branch: repo.branch,
      targetBranch: "main",
      hasExistingMrForTarget: false,
    });
    const llm = startMockLlmServer({ statusCode: 500, rawBody: "llm unavailable" });
    try {
      const result = await runCli(
        [
          "review",
          "--workflow",
          "create",
          "--mode",
          "ci",
          "--target-branch",
          "main",
          "--path",
          repo.repoPath,
        ],
        envForServices({ tempHome, gitlabUrl: gitlab.baseUrl, llmUrl: llm.baseUrl }),
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Merge Request Created");
      expect(result.stdout).toContain("Title: Merge feature/integration into main");
    } finally {
      gitlab.stop();
      llm.stop();
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  test("should fail create workflow when compare returns no diff", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    const gitlab = startMockGitLabServer({
      branch: repo.branch,
      targetBranch: "main",
      compareDiff: "",
    });
    const llm = startMockLlmServer({ answerText: "unused" });
    try {
      const result = await runCli(
        [
          "review",
          "--workflow",
          "create",
          "--mode",
          "ci",
          "--target-branch",
          "main",
          "--path",
          repo.repoPath,
        ],
        envForServices({ tempHome, gitlabUrl: gitlab.baseUrl, llmUrl: llm.baseUrl }),
      );
      expect(result.exitCode).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        "No differences found between source and target branches",
      );
    } finally {
      gitlab.stop();
      llm.stop();
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  test("should post only summary note when inline review has no actionable findings", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    const gitlab = startMockGitLabServer({ branch: repo.branch, hasOpenMr: true });
    const llm = startMockLlmServer({
      responder: (body) => {
        if (body.includes("Return ONLY valid JSON in this format")) {
          return JSON.stringify({
            findings: [
              {
                should_comment: false,
                severity: "Low",
                summary: "No actionable issue",
                suggested_fix: null,
                line: null,
                position_type: null,
                evidence_snippet: null,
              },
            ],
          });
        }
        return "Overall summary with no inline actions.";
      },
    });
    try {
      const result = await runCli(
        [
          "review",
          "--workflow",
          "default",
          "--mode",
          "ci",
          "--inline-comments",
          "--path",
          repo.repoPath,
        ],
        envForServices({ tempHome, gitlabUrl: gitlab.baseUrl, llmUrl: llm.baseUrl }),
      );
      expect(result.exitCode).toBe(0);
      expect(
        gitlab.requests.some((req) => req.method === "POST" && req.path.endsWith("/discussions")),
      ).toBe(false);
      expect(
        gitlab.requests.some((req) => req.method === "POST" && req.path.endsWith("/notes")),
      ).toBe(true);
    } finally {
      gitlab.stop();
      llm.stop();
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  test("should use --url for remote summarize when origin remote is missing", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    const gitlab = startMockGitLabServer({ branch: repo.branch, hasOpenMr: true });
    const llm = startMockLlmServer({ answerText: "Summary via --url path." });

    execFileSync("git", ["remote", "remove", "origin"], { cwd: repo.repoPath });

    try {
      const result = await runCli(
        [
          "review",
          "--workflow",
          "summarize",
          "--mode",
          "ci",
          "--path",
          repo.repoPath,
          "--url",
          "https://gitlab.local/group/project.git",
        ],
        envForServices({ tempHome, gitlabUrl: gitlab.baseUrl, llmUrl: llm.baseUrl }),
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Summary via --url path.");
    } finally {
      gitlab.stop();
      llm.stop();
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  test("should fail local summarize when stdin diff is missing", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    const llm = startMockLlmServer({ answerText: "unused" });
    try {
      const result = await runCli(
        ["review", "--workflow", "summarize", "--local", "--mode", "ci", "--path", repo.repoPath],
        envForServices({ tempHome, llmUrl: llm.baseUrl }),
      );
      expect(result.exitCode).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain("No diff provided for local review");
    } finally {
      llm.stop();
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });
});
