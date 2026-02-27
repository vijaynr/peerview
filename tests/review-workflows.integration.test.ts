import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { describe, expect, test } from "bun:test";
import { createTempGitRepo } from "./helpers/temp-repo";
import { runCli } from "./helpers/run-cli";
import { startMockGitLabServer } from "./mockservers/mock-gitlab-server";
import { startMockLlmServer } from "./mockservers/mock-llm-server";

function envWithMocks(args: {
  tempHome: string;
  gitlabUrl: string;
  llmUrl: string;
}): Record<string, string> {
  return {
    GITLAB_URL: args.gitlabUrl,
    GITLAB_KEY: "gitlab-test-token",
    OPENAI_API_URL: args.llmUrl,
    OPENAI_API_KEY: "llm-test-token",
    OPENAI_MODEL: "mock-model",
    HOME: args.tempHome,
    USERPROFILE: args.tempHome,
  };
}

describe("integration/review-workflows", () => {
  test("should reject chat workflow when --local is provided", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();

    try {
      const result = await runCli(
        ["review", "--workflow", "chat", "--local", "--path", repo.repoPath],
        {
          HOME: tempHome,
          USERPROFILE: tempHome,
        },
      );

      expect(result.exitCode).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain("not supported in chat mode");
    } finally {
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  test("should run local summarize when stdin diff is provided", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    const llm = startMockLlmServer({ answerText: "Local summarize output from mock." });

    try {
      const result = await runCli(
        ["review", "--workflow", "summarize", "--local", "--mode", "ci", "--path", repo.repoPath],
        {
          OPENAI_API_URL: llm.baseUrl,
          OPENAI_API_KEY: "llm-test-token",
          OPENAI_MODEL: "mock-model",
          HOME: tempHome,
          USERPROFILE: tempHome,
        },
        {
          stdinText: "diff --git a/a.ts b/a.ts\n@@ -1 +1 @@\n-old\n+new\n",
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Local summarize output from mock.");
      expect(llm.requests.length).toBe(1);
    } finally {
      llm.stop();
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  test("should run local review when stdin diff is provided", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    const llm = startMockLlmServer({ answerText: "Local review output from mock." });

    try {
      const result = await runCli(
        ["review", "--workflow", "default", "--local", "--mode", "ci", "--path", repo.repoPath],
        {
          OPENAI_API_URL: llm.baseUrl,
          OPENAI_API_KEY: "llm-test-token",
          OPENAI_MODEL: "mock-model",
          HOME: tempHome,
          USERPROFILE: tempHome,
        },
        {
          stdinText: "diff --git a/b.ts b/b.ts\n@@ -1 +1 @@\n-old\n+new\n",
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Local review output from mock.");
      expect(llm.requests.length).toBe(1);
    } finally {
      llm.stop();
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  test("should post summary note for remote review in ci mode", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    const gitlab = startMockGitLabServer({ branch: repo.branch, hasOpenMr: true });
    const llm = startMockLlmServer({ answerText: "Review body from integration mock." });

    try {
      const result = await runCli(
        ["review", "--workflow", "default", "--mode", "ci", "--path", repo.repoPath],
        envWithMocks({ tempHome, gitlabUrl: gitlab.baseUrl, llmUrl: llm.baseUrl }),
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Review body from integration mock.");
      expect(
        gitlab.requests.some(
          (req) => req.method === "POST" && req.path.endsWith("/notes"),
        ),
      ).toBe(true);
    } finally {
      gitlab.stop();
      llm.stop();
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  test("should post inline discussions and summary when --inline-comments is enabled", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    const gitlab = startMockGitLabServer({ branch: repo.branch, hasOpenMr: true });
    const llm = startMockLlmServer({
      responder: (body) => {
        if (body.includes("Return ONLY valid JSON in this format")) {
          return JSON.stringify({
            findings: [
              {
                should_comment: true,
                severity: "High",
                summary: "Inline issue from mock",
                suggested_fix: "Use safer call",
                line: 1,
                position_type: "new",
                evidence_snippet: "new",
              },
            ],
          });
        }
        return "Overall summary from inline integration test.";
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
        envWithMocks({ tempHome, gitlabUrl: gitlab.baseUrl, llmUrl: llm.baseUrl }),
      );

      expect(result.exitCode).toBe(0);
      expect(
        gitlab.requests.some(
          (req) => req.method === "POST" && req.path.endsWith("/discussions"),
        ),
      ).toBe(true);
      expect(
        gitlab.requests.some(
          (req) => req.method === "POST" && req.path.endsWith("/notes"),
        ),
      ).toBe(true);
    } finally {
      gitlab.stop();
      llm.stop();
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  test("should fail local review when stdin diff is missing", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    const llm = startMockLlmServer();

    try {
      const result = await runCli(
        ["review", "--workflow", "default", "--local", "--mode", "ci", "--path", repo.repoPath],
        {
          OPENAI_API_URL: llm.baseUrl,
          OPENAI_API_KEY: "llm-test-token",
          OPENAI_MODEL: "mock-model",
          HOME: tempHome,
          USERPROFILE: tempHome,
        },
      );

      expect(result.exitCode).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain("No diff provided for local review");
    } finally {
      llm.stop();
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  test("should fail create workflow in ci mode when target branch is missing", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    const gitlab = startMockGitLabServer({
      branch: repo.branch,
      hasOpenMr: true,
      targetBranch: "main",
    });
    const llm = startMockLlmServer();

    try {
      const result = await runCli(
        ["review", "--workflow", "create", "--mode", "ci", "--path", repo.repoPath],
        envWithMocks({ tempHome, gitlabUrl: gitlab.baseUrl, llmUrl: llm.baseUrl }),
      );

      expect(result.exitCode).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain("CI mode requires --target-branch.");
    } finally {
      gitlab.stop();
      llm.stop();
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  test("should create merge request in ci mode when target branch is provided", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    const gitlab = startMockGitLabServer({
      branch: repo.branch,
      hasOpenMr: true,
      targetBranch: "main",
      hasExistingMrForTarget: false,
    });
    const llm = startMockLlmServer({
      responder: (body) => {
        if (body.includes("Generate a concise GitLab merge request title")) {
          return "Integration MR Title";
        }
        return "Integration MR Description";
      },
    });

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
        envWithMocks({ tempHome, gitlabUrl: gitlab.baseUrl, llmUrl: llm.baseUrl }),
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Merge Request Created");
      expect(
        gitlab.requests.some(
          (req) => req.method === "POST" && req.path.endsWith("/merge_requests"),
        ),
      ).toBe(true);
    } finally {
      gitlab.stop();
      llm.stop();
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  test("should update merge request in ci mode when existing MR is found", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    const gitlab = startMockGitLabServer({
      branch: repo.branch,
      hasOpenMr: true,
      targetBranch: "main",
      hasExistingMrForTarget: true,
    });
    const llm = startMockLlmServer({
      responder: (body) => {
        if (body.includes("Generate a concise GitLab merge request title")) {
          return "Integration Updated MR Title";
        }
        return "Integration Updated MR Description";
      },
    });

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
        envWithMocks({ tempHome, gitlabUrl: gitlab.baseUrl, llmUrl: llm.baseUrl }),
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Merge Request Updated");
      expect(
        gitlab.requests.some(
          (req) => req.method === "PUT" && req.path.endsWith("/merge_requests/7"),
        ),
      ).toBe(true);
    } finally {
      gitlab.stop();
      llm.stop();
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  test("should fail create workflow when target branch does not exist remotely", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-home-"));
    const repo = await createTempGitRepo();
    const gitlab = startMockGitLabServer({
      branch: repo.branch,
      hasOpenMr: true,
      targetBranch: "main",
    });
    const llm = startMockLlmServer();

    try {
      const result = await runCli(
        [
          "review",
          "--workflow",
          "create",
          "--mode",
          "ci",
          "--target-branch",
          "release-does-not-exist",
          "--path",
          repo.repoPath,
        ],
        envWithMocks({ tempHome, gitlabUrl: gitlab.baseUrl, llmUrl: llm.baseUrl }),
      );

      expect(result.exitCode).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain("does not exist in remote repository");
    } finally {
      gitlab.stop();
      llm.stop();
      await repo.cleanup();
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });
});
