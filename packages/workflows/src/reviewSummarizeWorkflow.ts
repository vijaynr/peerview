import type { ReviewWorkflowInput, ReviewWorkflowResult } from "@pv/core";
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
  runWorkflow,
  type WorkflowRuntime,
} from "@pv/core";
import {
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

type SummarizeGraphState = {
  input: ReviewWorkflowInput;
  runtime: WorkflowRuntime | null;
  llm: LlmClient | null;
  gitlab: GitLabClient | null;
  remoteContext: RemoteMrContext | null;
  result: ReviewWorkflowResult | null;
};

const WORKFLOW_NAME = "reviewSummarize";

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

async function performSummaryNode(
  state: SummarizeGraphState
): Promise<{ result: ReviewWorkflowResult }> {
  const runtime = assertRuntime(state.runtime);
  const llm = assertLlm(state.llm);

  if (state.input.local) {
    const diff = state.input.stdinDiff?.trim() ?? "";
    if (!diff) {
      throw new Error("No diff provided for local review. Use: git diff | cr review --local");
    }
    const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, state.input.events);
    const template = await loadPrompt("summarize.txt", state.input.repoRoot);
    const prompt = injectMergeRequestContextIntoTemplate(template, {
      mrContent: "(Local review)",
      mrChanges: diff,
      mrCommits: "(N/A)",
    });
    phaseReporter.started("local_summary", "Summarizing local changes...");
    const output = await runLlmPrompt(prompt, llm);
    phaseReporter.completed("local_summary", "Local summary generated.");
    return {
      result: {
        output,
        inlineComments: [],
        contextLabel: "local diff",
        selectedAgents: [],
        aggregated: false,
      },
    };
  }

  const remoteContext = assertRemoteContext(state.remoteContext);
  const template = await loadPrompt("summarize.txt", state.input.repoRoot);
  const prompt = injectMergeRequestContextIntoTemplate(template, {
    mrContent: JSON.stringify(remoteContext.mr, null, 2),
    mrChanges: JSON.stringify(remoteContext.changes, null, 2),
    mrCommits: JSON.stringify(remoteContext.commits, null, 2),
  });
  const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, state.input.events);
  phaseReporter.started("generate_summary", "Generating summary...");
  const output = await runLlmPrompt(prompt, llm);
  phaseReporter.completed("generate_summary", "Summary generated.");
  return {
    result: {
      output,
      inlineComments: [],
      contextLabel: `MR !${remoteContext.mrIid} (${remoteContext.projectPath})`,
      selectedAgents: [],
      aggregated: false,
      mrIid: remoteContext.mrIid,
      projectPath: remoteContext.projectPath,
      gitlabUrl: runtime.gitlabUrl,
    },
  };
}

export async function runReviewSummarizeWorkflow(
  input: ReviewWorkflowInput
): Promise<ReviewWorkflowResult> {
  if (!input.local && input.provider === "github") {
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
    const template = await loadPrompt("summarize.txt", input.repoRoot);
    const prompt = injectMergeRequestContextIntoTemplate(template, {
      mrContent: JSON.stringify(remoteContext.pr, null, 2),
      mrChanges: JSON.stringify(remoteContext.files, null, 2),
      mrCommits: JSON.stringify(remoteContext.commits, null, 2),
    });
    const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, input.events);
    phaseReporter.started("generate_summary", "Generating summary...");
    const output = await runLlmPrompt(prompt, llm);
    phaseReporter.completed("generate_summary", "Summary generated.");
    return {
      output,
      inlineComments: [],
      contextLabel: `PR #${remoteContext.prNumber} (${remoteContext.repoPath})`,
      selectedAgents: [],
      aggregated: false,
      prNumber: remoteContext.prNumber,
      repoPath: remoteContext.repoPath,
      githubUrl: "https://github.com",
    };
  }

  const finalState = await runWorkflow<SummarizeGraphState>({
    initialState: {
      input: { ...input, workflow: "summarize" },
      runtime: null,
      llm: null,
      gitlab: null,
      remoteContext: null,
      result: null,
    },
    steps: {
      loadRuntime: initializeRuntimeNode,
      validateLlmConfiguration: validateLlmConfigNode,
      initializeLlmClient: initializeLlmClientNode,
      initializeGitLabClient: initializeGitLabClientNode,
      getMergeRequestContext: getMergeRequestContextNode,
      performSummary: performSummaryNode,
    },
    routes: {
      loadRuntime: "validateLlmConfiguration",
      validateLlmConfiguration: "initializeLlmClient",
      initializeLlmClient: (state) =>
        state.input.local ? "performSummary" : "initializeGitLabClient",
      initializeGitLabClient: "getMergeRequestContext",
      getMergeRequestContext: "performSummary",
      performSummary: "end",
    },
    start: "loadRuntime",
    end: "end",
  });

  if (!finalState.result) {
    throw new Error("Summary workflow did not produce a result.");
  }
  return finalState.result;
}
