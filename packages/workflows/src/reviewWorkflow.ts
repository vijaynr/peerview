import { getCurrentBranch, getOriginRemoteUrl } from "@cr/core";
import {
  createGitLabClient,
  type GitLabInlineComment,
  type GitLabClient,
  remoteToProjectPath,
} from "@cr/core";
import { type LlmClient } from "@cr/core";
import { loadPrompt } from "@cr/core";
import { createWorkflowPhaseReporter } from "./workflowEvents.js";
import {
  injectMergeRequestContextIntoTemplate,
  buildChatPrompt,
  extractJsonObject,
  parseDiffHunks,
  resolveInlinePosition,
  buildInlineReviewPrompt,
} from "./reviewWorkflowHelper.js";
import { maybePostReviewComment } from "./reviewWorkflowComments.js";
import {
  createRuntimeGitLabClient,
  createRuntimeLlmClient,
  loadWorkflowRuntime,
  type WorkflowRuntime,
} from "@cr/core";
import { assert } from "@cr/core";
import type {
  ReviewWorkflowInput,
  ReviewWorkflowResult,
  WorkflowMode,
} from "@cr/core";
import { runWorkflow } from "@cr/core";
export type {
  ReviewChatContext,
  ReviewChatHistoryEntry,
  ReviewWorkflowInput,
  ReviewWorkflowResult,
} from "@cr/core";

type RemoteMrContext = {
  projectPath: string;
  mrIid: number;
  mr: Awaited<ReturnType<GitLabClient["getMergeRequest"]>>;
  changes: Awaited<ReturnType<GitLabClient["getMergeRequestChanges"]>>;
  commits: Awaited<ReturnType<GitLabClient["getMergeRequestCommits"]>>;
  guidelines?: string;
};

type ReviewGraphState = {
  input: ReviewWorkflowInput;
  runtime: WorkflowRuntime | null;
  llm: LlmClient | null;
  gitlab: GitLabClient | null;
  remoteContext: RemoteMrContext | null;
  result: ReviewWorkflowResult | null;
  pendingFeedback: string;
  feedbackUsed: boolean;
};

const WORKFLOW_NAME = "review";

async function runLlmPrompt(prompt: string, llm: LlmClient): Promise<string> {
  return llm.generate(prompt);
}

function assertRuntime(runtime: WorkflowRuntime | null): WorkflowRuntime {
  return assert(runtime, "Workflow runtime not initialized.");
}

function assertLlm(llm: LlmClient | null): LlmClient {
  return assert(llm, "LLM client not initialized.");
}

function assertGitLab(gitlab: GitLabClient | null): GitLabClient {
  return assert(gitlab, "GitLab client not initialized.");
}

function assertRemoteContext(context: RemoteMrContext | null): RemoteMrContext {
  return assert(context, "Merge request context not initialized.");
}

async function resolveRemoteMrContext(
  input: ReviewWorkflowInput,
  gitlab: GitLabClient
): Promise<RemoteMrContext> {
  const repoUrl = input.url ?? (await getOriginRemoteUrl(input.repoPath));
  const projectPath = remoteToProjectPath(repoUrl);

  let mrIid: number;
  if (typeof input.mrIid === "number" && Number.isFinite(input.mrIid)) {
    mrIid = input.mrIid;
  } else if (input.mode === "ci") {
    const currentBranch = await getCurrentBranch(input.repoPath);
    const found = await gitlab.findOpenMergeRequestBySourceBranch(projectPath, currentBranch);
    if (!found) {
      throw new Error(`No open merge request found for current branch '${currentBranch}'.`);
    }
    mrIid = found.iid;
  } else {
    throw new Error(
      "Interactive mode requires a selected merge request iid from the command layer."
    );
  }

  const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, input.events);
  phaseReporter.started("load_mr_context", "Loading merge request context...");
  const [mr, changes, commits] = await Promise.all([
    gitlab.getMergeRequest(projectPath, mrIid),
    gitlab.getMergeRequestChanges(projectPath, mrIid),
    gitlab.getMergeRequestCommits(projectPath, mrIid),
  ]);

  let guidelines: string | undefined;
  try {
    const ref = mr.diff_refs?.head_sha || "HEAD";
    const content =
      (await gitlab.getFileRaw(projectPath, "GUIDELINES.md", ref)) ||
      (await gitlab.getFileRaw(projectPath, "Guidelines.md", ref));
    if (content) {
      guidelines = content;
    }
  } catch {
    // Ignore errors fetching guidelines
  }

  phaseReporter.completed("load_mr_context", "Loaded merge request context.");

  return { projectPath, mrIid, mr, changes, commits, guidelines };
}

async function buildInlineRemoteReview(
  input: ReviewWorkflowInput,
  gitlab: GitLabClient,
  llm: LlmClient,
  gitlabUrl: string,
  projectPath: string,
  mrIid: number,
  mr: unknown,
  changes: Array<{ old_path?: string; new_path?: string; diff?: string }>,
  commits: unknown,
  userFeedback?: string,
  guidelines?: string
): Promise<ReviewWorkflowResult> {
  const existingInlineComments = await gitlab.getMergeRequestInlineComments(projectPath, mrIid);
  const existingByFile = new Map<string, GitLabInlineComment[]>();
  for (const comment of existingInlineComments) {
    const items = existingByFile.get(comment.filePath) ?? [];
    items.push(comment);
    existingByFile.set(comment.filePath, items);
  }

  const inlineCandidates: ReviewWorkflowResult["inlineComments"] = [];
  const reviewLines: string[] = ["# File Review Summary", ""];
  const mrContent = JSON.stringify(mr, null, 2);
  const mrCommits = JSON.stringify(commits, null, 2);

  for (const change of changes) {
    const filePath = change.new_path ?? change.old_path;
    const diffText = change.diff ?? "";
    if (!filePath || !diffText.trim()) {
      continue;
    }

    const diffHunks = parseDiffHunks(diffText);
    const prompt = buildInlineReviewPrompt({
      filePath,
      diffText,
      mrContent,
      mrCommits,
      existingInlineComments: existingByFile.get(filePath) ?? [],
      userFeedback: userFeedback ?? input.userFeedback,
      guidelines,
    });
    const reviewText = await runLlmPrompt(prompt, llm);
    const parsed = extractJsonObject(reviewText);
    const rawFindings = Array.isArray(parsed.findings) ? parsed.findings : [];

    let actionableCount = 0;
    for (const raw of rawFindings) {
      if (!raw || typeof raw !== "object") {
        continue;
      }
      const finding = raw as Record<string, unknown>;
      const shouldComment =
        typeof finding.should_comment === "string"
          ? finding.should_comment.trim().toLowerCase() === "true"
          : Boolean(finding.should_comment);
      if (!shouldComment) {
        continue;
      }

      const summary = String(finding.summary ?? "").trim();
      const severity = String(finding.severity ?? "").trim();
      const fix = typeof finding.suggested_fix === "string" ? finding.suggested_fix.trim() : "";
      if (!summary) {
        continue;
      }

      actionableCount += 1;
      const resolved = resolveInlinePosition(
        finding.line,
        finding.position_type,
        finding.evidence_snippet,
        diffHunks
      );
      const lineLabel = resolved ? String(resolved[0]) : "n/a";
      const suffix = resolved ? "" : " (summary only: ambiguous line targeting)";
      const severityPrefix = severity ? `[${severity}] ` : "";
      if (fix) {
        reviewLines.push(
          `- \`${filePath}\` line \`${lineLabel}\`: ${severityPrefix}${summary} | Suggested fix: ${fix}${suffix}`
        );
      } else {
        reviewLines.push(
          `- \`${filePath}\` line \`${lineLabel}\`: ${severityPrefix}${summary}${suffix}`
        );
      }

      if (resolved) {
        const comment = fix ? `${summary}\n\nSuggested fix:\n${fix}` : summary;
        inlineCandidates.push({
          filePath,
          line: resolved[0],
          positionType: resolved[1],
          comment,
        });
      }
    }

    if (actionableCount === 0) {
      reviewLines.push(`- \`${filePath}\`: No issues found in this file.`);
    }
  }

  const baseTemplate = await loadPrompt("review.txt", input.repoRoot);
  const basePrompt = injectMergeRequestContextIntoTemplate(baseTemplate, {
    mrContent,
    mrChanges: JSON.stringify(changes, null, 2),
    mrCommits,
  });
  const summaryPromptBase = [
    "Using the following review instructions/context, provide only an MR-level final summary.",
    "Return markdown with these sections only:",
    "## Overall Summary",
    "- 2-4 bullets summarizing key risks and positives.",
    "## Overall Status",
    "- One line: Looks good for me! / Needs work / Discussion needed.",
    "",
    basePrompt,
  ].join("\n");
  const effectiveFeedback = userFeedback ?? input.userFeedback;
  const summaryPrompt = effectiveFeedback?.trim()
    ? `Human feedback for this re-run:\n${effectiveFeedback.trim()}\n\n${summaryPromptBase}`
    : summaryPromptBase;
  const overallSummary = (await runLlmPrompt(summaryPrompt, llm)).trim();

  const combined = `${reviewLines.join("\n")}\n\n# Overall MR Summary\n\n${overallSummary}`;
  return {
    output: combined,
    overallSummary,
    inlineComments: inlineCandidates,
    contextLabel: `MR !${mrIid} (${projectPath})`,
    mrIid,
    projectPath,
    gitlabUrl,
  };
}

async function generateRemoteReviewResult(
  input: ReviewWorkflowInput,
  gitlab: GitLabClient,
  llm: LlmClient,
  gitlabUrl: string,
  remoteContext?: RemoteMrContext,
  userFeedback?: string
): Promise<ReviewWorkflowResult> {
  const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, input.events);

  const { projectPath, mrIid, mr, changes, commits, guidelines } =
    remoteContext ?? (await resolveRemoteMrContext(input, gitlab));

  const template = await loadPrompt("review.txt", input.repoRoot);

  if (input.inlineComments) {
    phaseReporter.started("generate_review", "Generating review...");
    const inlineResult = await buildInlineRemoteReview(
      input,
      gitlab,
      llm,
      gitlabUrl,
      projectPath,
      mrIid,
      mr,
      changes,
      commits,
      userFeedback,
      guidelines
    );
    phaseReporter.completed("generate_review", "Review generated.");
    return { ...inlineResult, guidelines };
  }

  let prompt = injectMergeRequestContextIntoTemplate(template, {
    mrContent: JSON.stringify(mr, null, 2),
    mrChanges: JSON.stringify(changes, null, 2),
    mrCommits: JSON.stringify(commits, null, 2),
    guidelines,
  });
  const effectiveFeedback = userFeedback ?? input.userFeedback;
  if (effectiveFeedback?.trim()) {
    prompt = `Human feedback for this re-run:\n${effectiveFeedback.trim()}\n\n${prompt}`;
  }

  phaseReporter.started("generate_review", "Generating review...");
  const output = await runLlmPrompt(prompt, llm);
  phaseReporter.completed("generate_review", "Review generated.");

  return {
    output,
    inlineComments: [],
    contextLabel: `MR !${mrIid} (${projectPath})`,
    mrIid,
    projectPath,
    gitlabUrl,
  };
}

async function buildLocalPrompt(
  input: ReviewWorkflowInput,
  llm: LlmClient,
  userFeedback?: string
): Promise<ReviewWorkflowResult> {
  const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, input.events);
  const diff = input.stdinDiff?.trim() ?? "";
  if (!diff) {
    throw new Error("No diff provided for local review. Use: git diff | cr review --local");
  }

  let guidelines: string | undefined;
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const gPath1 = path.join(input.repoPath, "GUIDELINES.md");
    const gPath2 = path.join(input.repoPath, "Guidelines.md");

    const exists = async (p: string) =>
      fs
        .access(p)
        .then(() => true)
        .catch(() => false);

    if (await exists(gPath1)) {
      guidelines = await fs.readFile(gPath1, "utf-8");
    } else if (await exists(gPath2)) {
      guidelines = await fs.readFile(gPath2, "utf-8");
    }
  } catch {
    // ignore
  }

  const template = await loadPrompt("review.txt", input.repoRoot);
  let prompt = injectMergeRequestContextIntoTemplate(template, {
    mrContent: "(Local review)",
    mrChanges: diff,
    mrCommits: "(N/A)",
    guidelines,
  });
  const effectiveFeedback = userFeedback ?? input.userFeedback;
  if (effectiveFeedback?.trim()) {
    prompt = `Human feedback for this re-run:\n${effectiveFeedback.trim()}\n\n${prompt}`;
  }

  phaseReporter.started("local_review", "Reviewing local changes...");
  const output = await runLlmPrompt(prompt, llm);
  phaseReporter.completed("local_review", "Local review generated.");

  return {
    output,
    inlineComments: [],
    contextLabel: "local diff",
  };
}

async function initializeRuntimeNode(): Promise<{ runtime: WorkflowRuntime }> {
  return { runtime: await loadWorkflowRuntime() };
}

async function validateLlmConfigNode(state: {
  runtime: WorkflowRuntime | null;
}): Promise<Record<string, never>> {
  const runtime = assertRuntime(state.runtime);
  if (!runtime.openaiApiKey || !runtime.openaiApiUrl) {
    throw new Error(
      "Missing LLM configuration. Run `cr init` or set OPENAI_API_KEY/OPENAI_API_URL."
    );
  }
  return {};
}

async function initializeLlmClientNode(state: {
  runtime: WorkflowRuntime | null;
}): Promise<{ llm: LlmClient }> {
  return { llm: createRuntimeLlmClient(assertRuntime(state.runtime)) };
}

async function initializeGitLabClientNode(state: { runtime: WorkflowRuntime | null }): Promise<{
  gitlab: GitLabClient;
}> {
  const runtime = assertRuntime(state.runtime);
  if (!runtime.gitlabUrl || !runtime.gitlabKey) {
    throw new Error("Missing GitLab configuration. Run `cr init` or set GITLAB_URL/GITLAB_KEY.");
  }
  return { gitlab: createRuntimeGitLabClient(runtime) };
}

async function getMergeRequestContextNode(state: {
  input: ReviewWorkflowInput;
  gitlab: GitLabClient | null;
}): Promise<{ remoteContext: RemoteMrContext }> {
  return {
    remoteContext: await resolveRemoteMrContext(state.input, assertGitLab(state.gitlab)),
  };
}

async function performCodeReviewNode(
  state: ReviewGraphState
): Promise<{ result: ReviewWorkflowResult }> {
  const runtime = assertRuntime(state.runtime);
  const llm = assertLlm(state.llm);
  if (state.input.local) {
    return { result: await buildLocalPrompt(state.input, llm, state.pendingFeedback) };
  }
  const remoteContext = assertRemoteContext(state.remoteContext);
  return {
    result: await generateRemoteReviewResult(
      state.input,
      assertGitLab(state.gitlab),
      llm,
      runtime.gitlabUrl,
      remoteContext,
      state.pendingFeedback
    ),
  };
}

async function promptForFeedbackNode(_state: ReviewGraphState): Promise<{
  pendingFeedback: string;
  feedbackUsed: boolean;
}> {
  return {
    pendingFeedback: "",
    feedbackUsed: true,
  };
}

async function submitReviewToGitlabNode(): Promise<Record<string, never>> {
  // Posting is intentionally handled by maybePostReviewComment to preserve command UX.
  return {};
}

async function runReviewStateGraph(input: ReviewWorkflowInput): Promise<ReviewWorkflowResult> {
  const finalState = await runWorkflow<ReviewGraphState>({
    initialState: {
      input,
      runtime: null,
      llm: null,
      gitlab: null,
      remoteContext: null,
      result: null,
      pendingFeedback: input.userFeedback?.trim() ?? "",
      feedbackUsed: false,
    },
    steps: {
      loadRuntime: initializeRuntimeNode,
      validateLlmConfiguration: validateLlmConfigNode,
      initializeLlmClient: initializeLlmClientNode,
      initializeGitLabClient: initializeGitLabClientNode,
      getMergeRequestContext: getMergeRequestContextNode,
      performCodeReview: performCodeReviewNode,
      promptForFeedback: promptForFeedbackNode,
      submitReviewToGitlab: submitReviewToGitlabNode,
    },
    routes: {
      loadRuntime: "validateLlmConfiguration",
      validateLlmConfiguration: "initializeLlmClient",
      initializeLlmClient: (state) =>
        state.input.local ? "performCodeReview" : "initializeGitLabClient",
      initializeGitLabClient: "getMergeRequestContext",
      getMergeRequestContext: "performCodeReview",
      performCodeReview: "promptForFeedback",
      promptForFeedback: (state) =>
        state.pendingFeedback ? "performCodeReview" : "submitReviewToGitlab",
      submitReviewToGitlab: "end",
    },
    start: "loadRuntime",
    end: "end",
  });

  if (!finalState.result) {
    throw new Error("Review workflow did not produce a result.");
  }
  return finalState.result;
}

export async function runReviewWorkflow(input: ReviewWorkflowInput): Promise<ReviewWorkflowResult> {
  if (input.workflow !== WORKFLOW_NAME) {
    throw new Error("Use reviewChatWorkflow.ts or reviewSummarizeWorkflow.ts for non-review workflows.");
  }
  return runReviewStateGraph(input);
}

export const __test__ = {
  extractJsonObject,
  parseDiffHunks,
  resolveInlinePosition,
  injectMergeRequestContextIntoTemplate,
  buildChatPrompt,
};
