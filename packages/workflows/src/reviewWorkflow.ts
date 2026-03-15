import type {
  ReviewWorkflowEffect,
  ReviewWorkflowInput,
  ReviewWorkflowResponse,
  ReviewWorkflowResult,
} from "@cr/core";
import {
  assert,
  createRuntimeGitLabClient,
  createRuntimeLlmClient,
  createRuntimeSvnClient,
  DEFAULT_REVIEW_AGENT_NAME,
  type GitLabClient,
  type GitLabInlineComment,
  getCurrentBranch,
  getOriginRemoteUrl,
  type LlmClient,
  loadGitLabRepositoryGuidelines,
  loadLocalRepositoryGuidelines,
  loadPrompt,
  loadReviewAgentPrompt,
  loadSvnRepositoryGuidelines,
  loadWorkflowRuntime,
  normalizeReviewAgentNames,
  remoteToProjectPath,
  runWorkflow,
  type WorkflowRuntime,
} from "@cr/core";
import {
  buildChatPrompt,
  buildInlineReviewPrompt,
  extractJsonObject,
  injectMergeRequestContextIntoTemplate,
  parseDiffHunks,
  resolveInlinePosition,
} from "./reviewWorkflowHelper.js";
import { createWorkflowPhaseReporter } from "./workflowEvents.js";

export type {
  ReviewChatContext,
  ReviewChatHistoryEntry,
  ReviewWorkflowEffect,
  ReviewWorkflowInput,
  ReviewWorkflowResponse,
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

type ReviewPromptContext = {
  mrContent: string;
  mrChanges: string;
  mrCommits: string;
  guidelines?: string;
  contextLabel: string;
};

type AgentExecutionResult = NonNullable<ReviewWorkflowResult["agentResults"]>[number];

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
type ReviewWorkflowResponseInput = ReviewWorkflowResponse | undefined;

async function runLlmPrompt(prompt: string, llm: LlmClient): Promise<string> {
  return llm.generate(prompt);
}

function reportFeedbackRegeneration(input: Pick<ReviewWorkflowInput, "status">): void {
  input.status?.info("Regenerating review with your feedback...");
}

function reportInlineCommentLimitation(input: Pick<ReviewWorkflowInput, "status">): void {
  input.status?.warning(
    "Multi-agent review does not support inline comments yet. This run will post a summary comment only."
  );
}

function assertResponseType(response: ReviewWorkflowResponseInput): ReviewWorkflowResponse {
  if (!response || response.type !== "review_feedback") {
    const actual = response?.type ?? "none";
    throw new Error(`Expected review workflow response "review_feedback", received "${actual}".`);
  }
  return response;
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

function shouldUseAgentProfiles(selectedAgents: string[]): boolean {
  return !(selectedAgents.length === 1 && selectedAgents[0] === DEFAULT_REVIEW_AGENT_NAME);
}

function buildReviewResult(args: {
  output: string;
  contextLabel: string;
  selectedAgents: string[];
  aggregated: boolean;
  inlineComments?: ReviewWorkflowResult["inlineComments"];
  overallSummary?: string;
  agentResults?: ReviewWorkflowResult["agentResults"];
  mrIid?: number;
  projectPath?: string;
  gitlabUrl?: string;
  rbUrl?: string;
  guidelines?: string;
}): ReviewWorkflowResult {
  return {
    output: args.output,
    contextLabel: args.contextLabel,
    selectedAgents: args.selectedAgents,
    aggregated: args.aggregated,
    inlineComments: args.inlineComments ?? [],
    overallSummary: args.overallSummary,
    agentResults: args.agentResults,
    mrIid: args.mrIid,
    projectPath: args.projectPath,
    gitlabUrl: args.gitlabUrl,
    rbUrl: args.rbUrl,
    guidelines: args.guidelines,
  };
}

function createPromptContextFromRemoteContext(remoteContext: RemoteMrContext): ReviewPromptContext {
  return {
    mrContent: JSON.stringify(remoteContext.mr, null, 2),
    mrChanges: JSON.stringify(remoteContext.changes, null, 2),
    mrCommits: JSON.stringify(remoteContext.commits, null, 2),
    guidelines: remoteContext.guidelines,
    contextLabel: `MR !${remoteContext.mrIid} (${remoteContext.projectPath})`,
  };
}

function prependFeedback(prompt: string, feedback?: string): string {
  return feedback?.trim()
    ? `Human feedback for this re-run:\n${feedback.trim()}\n\n${prompt}`
    : prompt;
}

async function runReviewAgent(args: {
  agentName: string;
  promptContext: ReviewPromptContext;
  repoRoot: string;
  llm: LlmClient;
  userFeedback?: string;
}): Promise<AgentExecutionResult> {
  const template = await loadReviewAgentPrompt(args.agentName, args.repoRoot);
  const prompt = prependFeedback(
    injectMergeRequestContextIntoTemplate(template, {
      mrContent: args.promptContext.mrContent,
      mrChanges: args.promptContext.mrChanges,
      mrCommits: args.promptContext.mrCommits,
      guidelines: args.promptContext.guidelines,
    }),
    args.userFeedback
  );

  return {
    name: args.agentName,
    output: (await runLlmPrompt(prompt, args.llm)).trim(),
  };
}

function fillAggregateTemplate(
  template: string,
  args: {
    contextLabel: string;
    successfulAgentOutputs: string;
    failedAgents: string;
  }
): string {
  return template
    .replaceAll("{context_label}", args.contextLabel)
    .replaceAll("{agent_outputs}", args.successfulAgentOutputs)
    .replaceAll("{failed_agents}", args.failedAgents);
}

async function aggregateAgentOutputs(args: {
  llm: LlmClient;
  repoRoot: string;
  contextLabel: string;
  successfulAgents: AgentExecutionResult[];
  failedAgents: AgentExecutionResult[];
}): Promise<string> {
  const template = await loadPrompt("review-aggregate.txt", args.repoRoot);
  const prompt = fillAggregateTemplate(template, {
    contextLabel: args.contextLabel,
    successfulAgentOutputs: args.successfulAgents
      .map((result) => `## ${result.name}\n${result.output}`)
      .join("\n\n"),
    failedAgents:
      args.failedAgents.length > 0
        ? args.failedAgents
            .map((result) => `- ${result.name}: ${result.error ?? "Unknown error"}`)
            .join("\n")
        : "- None",
  });

  return (await runLlmPrompt(prompt, args.llm)).trim();
}

async function runParallelAgentReviews(args: {
  selectedAgents: string[];
  promptContext: ReviewPromptContext;
  repoRoot: string;
  llm: LlmClient;
  userFeedback?: string;
}): Promise<{ output: string; agentResults: AgentExecutionResult[]; aggregated: boolean }> {
  const settled = await Promise.allSettled(
    args.selectedAgents.map((agentName) =>
      runReviewAgent({
        agentName,
        promptContext: args.promptContext,
        repoRoot: args.repoRoot,
        llm: args.llm,
        userFeedback: args.userFeedback,
      })
    )
  );

  const agentResults: AgentExecutionResult[] = settled.map((result, index) =>
    result.status === "fulfilled"
      ? result.value
      : {
          name: args.selectedAgents[index],
          output: "",
          failed: true,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        }
  );

  const successfulAgents = agentResults.filter((result) => !result.failed);
  const failedAgents = agentResults.filter((result) => result.failed);

  if (successfulAgents.length === 0) {
    throw new Error("All review agents failed. No aggregated review could be generated.");
  }

  if (successfulAgents.length === 1 && args.selectedAgents.length === 1) {
    return {
      output: successfulAgents[0].output,
      agentResults,
      aggregated: false,
    };
  }

  return {
    output: await aggregateAgentOutputs({
      llm: args.llm,
      repoRoot: args.repoRoot,
      contextLabel: args.promptContext.contextLabel,
      successfulAgents,
      failedAgents,
    }),
    agentResults,
    aggregated: true,
  };
}

async function resolveRemoteMrContext(
  input: ReviewWorkflowInput,
  gitlab: GitLabClient,
  runtime: WorkflowRuntime
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
    guidelines =
      (await loadGitLabRepositoryGuidelines({
        gitlab,
        projectPath,
        ref,
      })) ?? (await loadSvnRepositoryGuidelines(createRuntimeSvnClient(runtime)));
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
  return buildReviewResult({
    output: combined,
    overallSummary,
    inlineComments: inlineCandidates,
    contextLabel: `MR !${mrIid} (${projectPath})`,
    mrIid,
    projectPath,
    gitlabUrl,
    guidelines,
    selectedAgents: [DEFAULT_REVIEW_AGENT_NAME],
    aggregated: false,
  });
}

async function generateRemoteReviewResult(
  input: ReviewWorkflowInput,
  gitlab: GitLabClient,
  llm: LlmClient,
  runtime: WorkflowRuntime,
  gitlabUrl: string,
  remoteContext?: RemoteMrContext,
  userFeedback?: string
): Promise<ReviewWorkflowResult> {
  const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, input.events);

  const { projectPath, mrIid, mr, changes, commits, guidelines } =
    remoteContext ?? (await resolveRemoteMrContext(input, gitlab, runtime));
  const selectedAgents = normalizeReviewAgentNames(input.agentNames);
  const useAgentProfiles = shouldUseAgentProfiles(selectedAgents);

  if (input.inlineComments && useAgentProfiles) {
    reportInlineCommentLimitation(input);
  }

  if (input.inlineComments && !useAgentProfiles) {
    phaseReporter.started(
      "generate_review",
      useAgentProfiles && selectedAgents.length > 1
        ? `Generating review with ${selectedAgents.length} agents...`
        : "Generating review..."
    );
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

  const promptContext = createPromptContextFromRemoteContext({
    projectPath,
    mrIid,
    mr,
    changes,
    commits,
    guidelines,
  });

  phaseReporter.started(
    "generate_review",
    useAgentProfiles && selectedAgents.length > 1
      ? `Generating review with ${selectedAgents.length} agents...`
      : "Generating review..."
  );

  if (useAgentProfiles) {
    const parallelReview = await runParallelAgentReviews({
      selectedAgents,
      promptContext,
      repoRoot: input.repoRoot,
      llm,
      userFeedback,
    });
    phaseReporter.completed("generate_review", "Review generated.");

    return buildReviewResult({
      output: parallelReview.output,
      contextLabel: promptContext.contextLabel,
      selectedAgents,
      aggregated: parallelReview.aggregated,
      agentResults: parallelReview.agentResults,
      mrIid,
      projectPath,
      gitlabUrl,
      guidelines,
    });
  }

  const template = await loadPrompt("review.txt", input.repoRoot);
  let prompt = injectMergeRequestContextIntoTemplate(template, {
    mrContent: promptContext.mrContent,
    mrChanges: promptContext.mrChanges,
    mrCommits: promptContext.mrCommits,
    guidelines,
  });
  prompt = prependFeedback(prompt, userFeedback ?? input.userFeedback);

  const output = await runLlmPrompt(prompt, llm);
  phaseReporter.completed("generate_review", "Review generated.");

  return buildReviewResult({
    output,
    contextLabel: promptContext.contextLabel,
    selectedAgents,
    aggregated: false,
    mrIid,
    projectPath,
    gitlabUrl,
    guidelines,
  });
}

async function buildLocalPrompt(
  input: ReviewWorkflowInput,
  llm: LlmClient,
  runtime: WorkflowRuntime,
  userFeedback?: string
): Promise<ReviewWorkflowResult> {
  const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, input.events);
  const diff = input.stdinDiff?.trim() ?? "";
  if (!diff) {
    throw new Error("No diff provided for local review. Use: git diff | cr review --local");
  }

  let guidelines: string | undefined;
  try {
    guidelines =
      (await loadLocalRepositoryGuidelines(input.repoPath)) ??
      (await loadSvnRepositoryGuidelines(createRuntimeSvnClient(runtime)));
  } catch {
    // ignore
  }

  const selectedAgents = normalizeReviewAgentNames(input.agentNames);
  const useAgentProfiles = shouldUseAgentProfiles(selectedAgents);
  const promptContext: ReviewPromptContext = {
    mrContent: "(Local review)",
    mrChanges: diff,
    mrCommits: "(N/A)",
    guidelines,
    contextLabel: "local diff",
  };

  phaseReporter.started(
    "local_review",
    useAgentProfiles && selectedAgents.length > 1
      ? `Reviewing local changes with ${selectedAgents.length} agents...`
      : "Reviewing local changes..."
  );

  if (useAgentProfiles) {
    const parallelReview = await runParallelAgentReviews({
      selectedAgents,
      promptContext,
      repoRoot: input.repoRoot,
      llm,
      userFeedback,
    });
    phaseReporter.completed("local_review", "Local review generated.");
    return buildReviewResult({
      output: parallelReview.output,
      contextLabel: promptContext.contextLabel,
      selectedAgents,
      aggregated: parallelReview.aggregated,
      agentResults: parallelReview.agentResults,
      guidelines,
    });
  }

  const template = await loadPrompt("review.txt", input.repoRoot);
  const prompt = prependFeedback(
    injectMergeRequestContextIntoTemplate(template, {
      mrContent: promptContext.mrContent,
      mrChanges: promptContext.mrChanges,
      mrCommits: promptContext.mrCommits,
      guidelines,
    }),
    userFeedback ?? input.userFeedback
  );

  const output = await runLlmPrompt(prompt, llm);
  phaseReporter.completed("local_review", "Local review generated.");

  return buildReviewResult({
    output,
    contextLabel: promptContext.contextLabel,
    selectedAgents,
    aggregated: false,
    guidelines,
  });
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
  runtime: WorkflowRuntime | null;
  gitlab: GitLabClient | null;
}): Promise<{ remoteContext: RemoteMrContext }> {
  return {
    remoteContext: await resolveRemoteMrContext(
      state.input,
      assertGitLab(state.gitlab),
      assertRuntime(state.runtime)
    ),
  };
}

async function performCodeReviewNode(
  state: ReviewGraphState
): Promise<{ result: ReviewWorkflowResult }> {
  const runtime = assertRuntime(state.runtime);
  const llm = assertLlm(state.llm);
  if (state.input.local) {
    return {
      result: await buildLocalPrompt(state.input, llm, runtime, state.pendingFeedback),
    };
  }
  const remoteContext = assertRemoteContext(state.remoteContext);
  return {
    result: await generateRemoteReviewResult(
      state.input,
      assertGitLab(state.gitlab),
      llm,
      runtime,
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
    throw new Error(
      "Use reviewChatWorkflow.ts or reviewSummarizeWorkflow.ts for non-review workflows."
    );
  }
  return runReviewStateGraph(input);
}

export async function* runInteractiveReviewWorkflow(
  input: ReviewWorkflowInput
): AsyncGenerator<ReviewWorkflowEffect, ReviewWorkflowResult, ReviewWorkflowResponseInput> {
  if (input.workflow !== WORKFLOW_NAME) {
    throw new Error(
      "Use reviewChatWorkflow.ts or reviewSummarizeWorkflow.ts for non-review workflows."
    );
  }

  let feedback = input.userFeedback?.trim() ?? "";

  for (;;) {
    const result = await runReviewStateGraph({
      ...input,
      userFeedback: feedback,
    });

    yield {
      type: "review_ready",
      result,
    };

    if (input.mode !== "interactive") {
      return result;
    }

    const response = assertResponseType(
      yield {
        type: "request_review_feedback",
        result,
      }
    );
    const nextFeedback = response.feedback?.trim() ?? "";
    if (!nextFeedback) {
      return result;
    }

    reportFeedbackRegeneration(input);
    feedback = nextFeedback;
  }
}

export const __test__ = {
  extractJsonObject,
  parseDiffHunks,
  resolveInlinePosition,
  injectMergeRequestContextIntoTemplate,
  buildChatPrompt,
  shouldUseAgentProfiles,
  fillAggregateTemplate,
};
