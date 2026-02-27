import { getCurrentBranch, getOriginRemoteUrl } from "../utils/git.js";
import { type LlmClient } from "../clients/llm-client.js";
import { loadPrompt } from "../utils/prompts.js";
import { createWorkflowPhaseReporter } from "../utils/workflow-events.js";
import { type GitLabClient, remoteToProjectPath } from "../clients/gitlab-client.js";
import {
  buildChatPrompt,
  injectMergeRequestContextIntoTemplate,
} from "../utils/review-workflow-helpers.js";
import {
  createRuntimeGitLabClient,
  createRuntimeLlmClient,
  loadWorkflowRuntime,
  type WorkflowRuntime,
} from "../utils/workflow-runtime.js";
import type {
  ReviewChatContext,
  ReviewChatHistoryEntry,
  ReviewWorkflowInput,
} from "../types/workflows.js";
import { runSequentialWorkflow } from "../utils/workflow.js";

type RemoteMrContext = {
  projectPath: string;
  mrIid: number;
  mr: Awaited<ReturnType<GitLabClient["getMergeRequest"]>>;
  changes: Awaited<ReturnType<GitLabClient["getMergeRequestChanges"]>>;
  commits: Awaited<ReturnType<GitLabClient["getMergeRequestCommits"]>>;
};

type ChatGraphState = {
  input: ReviewWorkflowInput;
  runtime: WorkflowRuntime | null;
  llm: LlmClient | null;
  gitlab: GitLabClient | null;
  remoteContext: RemoteMrContext | null;
  summary: string;
  context: ReviewChatContext | null;
};

function assertRuntime(runtime: WorkflowRuntime | null): WorkflowRuntime {
  if (!runtime) {
    throw new Error("Workflow runtime not initialized.");
  }
  return runtime;
}

function assertLlm(llm: LlmClient | null): LlmClient {
  if (!llm) {
    throw new Error("LLM client not initialized.");
  }
  return llm;
}

function assertGitLab(gitlab: GitLabClient | null): GitLabClient {
  if (!gitlab) {
    throw new Error("GitLab client not initialized.");
  }
  return gitlab;
}

function assertRemoteContext(context: RemoteMrContext | null): RemoteMrContext {
  if (!context) {
    throw new Error("Merge request context not initialized.");
  }
  return context;
}

async function runLlmPrompt(prompt: string, llm: LlmClient): Promise<string> {
  return llm.generate(prompt);
}

function formatChatHistory(history: ReviewChatHistoryEntry[]): string {
  return history.map((entry) => `Q: ${entry.question}\nA: ${entry.answer}`).join("\n\n");
}

async function summarizeChatHistory(
  history: ReviewChatHistoryEntry[],
  llm: LlmClient
): Promise<ReviewChatHistoryEntry[]> {
  if (history.length <= 10) {
    return history;
  }
  const summaryPrompt = [
    "Summarize the following Q&A chat history in a concise way for future context.",
    formatChatHistory(history),
  ].join("\n\n");
  const summary = (await runLlmPrompt(summaryPrompt, llm)).trim();
  return [{ question: "Chat history summary", answer: summary }];
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

  const phaseReporter = createWorkflowPhaseReporter("review", input.events);
  phaseReporter.started("load_mr_context", "Loading merge request context...");
  const [mr, changes, commits] = await Promise.all([
    gitlab.getMergeRequest(projectPath, mrIid),
    gitlab.getMergeRequestChanges(projectPath, mrIid),
    gitlab.getMergeRequestCommits(projectPath, mrIid),
  ]);
  phaseReporter.completed("load_mr_context", "Loaded merge request context.");

  return { projectPath, mrIid, mr, changes, commits };
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

async function generateChatSummaryNode(state: ChatGraphState): Promise<{ summary: string }> {
  const llm = assertLlm(state.llm);
  const remoteContext = assertRemoteContext(state.remoteContext);
  const phaseReporter = createWorkflowPhaseReporter("review", state.input.events);
  phaseReporter.started("chat_context_summary", "Summarizing merge request changes...");
  const summarizeTemplate = await loadPrompt("summarize.txt", state.input.repoRoot);
  const summarizePrompt = injectMergeRequestContextIntoTemplate(summarizeTemplate, {
    mrContent: JSON.stringify(remoteContext.mr, null, 2),
    mrChanges: JSON.stringify(remoteContext.changes, null, 2),
    mrCommits: JSON.stringify(remoteContext.commits, null, 2),
  });
  const summary = await runLlmPrompt(summarizePrompt, llm);
  phaseReporter.completed("chat_context_summary", "Summary generated.");
  return { summary };
}

async function finalizeChatContextNode(
  state: ChatGraphState
): Promise<{ context: ReviewChatContext }> {
  const remoteContext = assertRemoteContext(state.remoteContext);
  return {
    context: {
      contextLabel: `MR !${remoteContext.mrIid} (${remoteContext.projectPath})`,
      mrContent: JSON.stringify(remoteContext.mr, null, 2),
      mrChanges: JSON.stringify(remoteContext.changes, null, 2),
      mrCommits: JSON.stringify(remoteContext.commits, null, 2),
      summary: state.summary,
    },
  };
}

async function runChatStateGraph(input: ReviewWorkflowInput): Promise<ReviewChatContext> {
  const finalState = await runSequentialWorkflow<ChatGraphState>(
    {
      input,
      runtime: null,
      llm: null,
      gitlab: null,
      remoteContext: null,
      summary: "",
      context: null,
    },
    [
      initializeRuntimeNode,
      validateLlmConfigNode,
      initializeLlmClientNode,
      initializeGitLabClientNode,
      getMergeRequestContextNode,
      generateChatSummaryNode,
      finalizeChatContextNode,
    ]
  );

  if (!finalState.context) {
    throw new Error("Chat workflow did not produce context.");
  }
  return finalState.context;
}

export async function runReviewChatWorkflow(
  input: ReviewWorkflowInput
): Promise<ReviewChatContext> {
  if (input.local) {
    throw new Error("The --local option is not supported in chat mode.");
  }
  return runChatStateGraph(input);
}

export async function answerReviewChatQuestion(args: {
  repoRoot: string;
  context: ReviewChatContext;
  question: string;
  history: ReviewChatHistoryEntry[];
}): Promise<{ answer: string; history: ReviewChatHistoryEntry[] }> {
  const runtime = await loadWorkflowRuntime();

  if (!runtime.openaiApiKey || !runtime.openaiApiUrl) {
    throw new Error(
      "Missing LLM configuration. Run `cr init` or set OPENAI_API_KEY/OPENAI_API_URL."
    );
  }

  const llm = createRuntimeLlmClient(runtime);
  const compressedHistory = await summarizeChatHistory(args.history, llm);
  const chatTemplate = await loadPrompt("chat.txt", args.repoRoot).catch(() => "");
  const prompt = buildChatPrompt({
    question: args.question,
    history: compressedHistory,
    context: args.context,
    chatTemplate,
  });
  const answer = await runLlmPrompt(prompt, llm);
  return {
    answer,
    history: [...compressedHistory, { question: args.question, answer }],
  };
}
