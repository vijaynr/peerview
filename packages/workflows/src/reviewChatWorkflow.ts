import type {
  ReviewChatContext,
  ReviewChatHistoryEntry,
  ReviewWorkflowInput,
  WorkflowEventReporter,
} from "@pv/core";
import {
  createRuntimeGitHubClient,
  createRuntimeGitLabClient,
  createRuntimeLlmClient,
  type GitHubClient,
  type GitLabClient,
  getCurrentBranch,
  getOriginRemoteUrl,
  type LlmClient,
  loadPrompt,
  loadWorkflowRuntime,
  remoteToGitHubRepoPath,
  remoteToProjectPath,
  runSequentialWorkflow,
  type WorkflowRuntime,
} from "@pv/core";
import {
  buildChatPrompt,
  injectMergeRequestContextIntoTemplate,
  resolveGitLabBaseUrl,
} from "./reviewWorkflowHelper.js";
import { createWorkflowPhaseReporter } from "./workflowEvents.js";

type RemoteMrContext = {
  projectPath: string;
  mrIid: number;
  mr: Awaited<ReturnType<GitLabClient["getMergeRequest"]>>;
  changes: Awaited<ReturnType<GitLabClient["getMergeRequestChanges"]>>;
  commits: Awaited<ReturnType<GitLabClient["getMergeRequestCommits"]>>;
};

type RemotePrContext = {
  repoPath: string;
  prNumber: number;
  pr: Awaited<ReturnType<GitHubClient["getPullRequest"]>>;
  files: Awaited<ReturnType<GitHubClient["getPullRequestFiles"]>>;
  commits: Awaited<ReturnType<GitHubClient["getPullRequestCommits"]>>;
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

const WORKFLOW_NAME = "reviewChat";

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

  const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, input.events);
  phaseReporter.started("load_mr_context", "Loading merge request context...");
  const [mr, changes, commits] = await Promise.all([
    gitlab.getMergeRequest(projectPath, mrIid),
    gitlab.getMergeRequestChanges(projectPath, mrIid),
    gitlab.getMergeRequestCommits(projectPath, mrIid),
  ]);
  phaseReporter.completed("load_mr_context", "Loaded merge request context.");

  return { projectPath, mrIid, mr, changes, commits };
}

async function resolveRemotePrContext(
  input: ReviewWorkflowInput,
  github: GitHubClient
): Promise<RemotePrContext> {
  const repoUrl = input.url ?? (await getOriginRemoteUrl(input.repoPath));
  const repoPath = remoteToGitHubRepoPath(repoUrl);

  let prNumber: number;
  if (typeof input.prNumber === "number" && Number.isFinite(input.prNumber)) {
    prNumber = input.prNumber;
  } else if (input.mode === "ci") {
    const currentBranch = await getCurrentBranch(input.repoPath);
    const found = await github.findOpenPullRequestByHead(repoPath, currentBranch);
    if (!found) {
      throw new Error(`No open pull request found for current branch '${currentBranch}'.`);
    }
    prNumber = found.number;
  } else {
    throw new Error("Interactive mode requires a selected pull request number from the command layer.");
  }

  const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, input.events);
  phaseReporter.started("load_mr_context", "Loading pull request context...");
  const [pr, files, commits] = await Promise.all([
    github.getPullRequest(repoPath, prNumber),
    github.getPullRequestFiles(repoPath, prNumber),
    github.getPullRequestCommits(repoPath, prNumber),
  ]);
  phaseReporter.completed("load_mr_context", "Loaded pull request context.");

  return { repoPath, prNumber, pr, files, commits };
}

async function initializeRuntimeNode(state: {
  input: ReviewWorkflowInput;
}): Promise<{ runtime: WorkflowRuntime }> {
  const runtime = await loadWorkflowRuntime();
  return {
    runtime: {
      ...runtime,
      gitlabUrl: resolveGitLabBaseUrl(runtime.gitlabUrl, state.input),
    },
  };
}

async function validateLlmConfigNode(state: {
  runtime: WorkflowRuntime | null;
}): Promise<Record<string, never>> {
  const runtime = assertRuntime(state.runtime);
  if (!runtime.openaiApiKey || !runtime.openaiApiUrl) {
    throw new Error(
      "Missing LLM configuration. Run `pv init` or set OPENAI_API_KEY/OPENAI_API_URL."
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
    throw new Error("Missing GitLab configuration. Run `pv init` or set GITLAB_URL/GITLAB_KEY.");
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
  const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, state.input.events);
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
  if (input.provider === "github") {
    const runtime = await loadWorkflowRuntime();
    if (!runtime.openaiApiKey || !runtime.openaiApiUrl) {
      throw new Error(
        "Missing LLM configuration. Run `pv init` or set OPENAI_API_KEY/OPENAI_API_URL."
      );
    }
    if (!runtime.githubToken) {
      throw new Error("Missing GitHub configuration. Run `pv init --github` or set GITHUB_TOKEN.");
    }
    const llm = createRuntimeLlmClient(runtime);
    const github = createRuntimeGitHubClient(runtime);
    const remoteContext = await resolveRemotePrContext(input, github);
    const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, input.events);
    phaseReporter.started("chat_context_summary", "Summarizing pull request changes...");
    const summarizeTemplate = await loadPrompt("summarize.txt", input.repoRoot);
    const summarizePrompt = injectMergeRequestContextIntoTemplate(summarizeTemplate, {
      mrContent: JSON.stringify(remoteContext.pr, null, 2),
      mrChanges: JSON.stringify(remoteContext.files, null, 2),
      mrCommits: JSON.stringify(remoteContext.commits, null, 2),
    });
    const summary = await runLlmPrompt(summarizePrompt, llm);
    phaseReporter.completed("chat_context_summary", "Summary generated.");
    return {
      contextLabel: `PR #${remoteContext.prNumber} (${remoteContext.repoPath})`,
      mrContent: JSON.stringify(remoteContext.pr, null, 2),
      mrChanges: JSON.stringify(remoteContext.files, null, 2),
      mrCommits: JSON.stringify(remoteContext.commits, null, 2),
      summary,
    };
  }
  return runChatStateGraph(input);
}

export async function answerReviewChatQuestion(args: {
  repoRoot: string;
  context: ReviewChatContext;
  question: string;
  history: ReviewChatHistoryEntry[];
  events?: WorkflowEventReporter;
}): Promise<{ answer: string; history: ReviewChatHistoryEntry[] }> {
  const runtime = await loadWorkflowRuntime();

  if (!runtime.openaiApiKey || !runtime.openaiApiUrl) {
    throw new Error(
      "Missing LLM configuration. Run `pv init` or set OPENAI_API_KEY/OPENAI_API_URL."
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

  const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, args.events);
  phaseReporter.started("answering_question", "Thinking...");
  const answer = await runLlmPrompt(prompt, llm);
  phaseReporter.completed("answering_question", "");

  return {
    answer,
    history: [...compressedHistory, { question: args.question, answer }],
  };
}
