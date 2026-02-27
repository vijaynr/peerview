import { getCurrentBranch, getOriginRemoteUrl } from "../utils/git.js";
import { type LlmClient } from "../clients/llm-client.js";
import { loadPrompt } from "../utils/prompts.js";
import { createWorkflowPhaseReporter } from "../utils/workflow-events.js";
import { type GitLabClient, remoteToProjectPath } from "../clients/gitlab-client.js";
import { injectMergeRequestContextIntoTemplate } from "../utils/review-workflow-helpers.js";
import {
  createRuntimeGitLabClient,
  createRuntimeLlmClient,
  loadWorkflowRuntime,
  type WorkflowRuntime,
} from "../utils/workflow-runtime.js";
import type { ReviewWorkflowInput, ReviewWorkflowResult } from "../types/workflows.js";
import { runWorkflow } from "../utils/workflow.js";

type RemoteMrContext = {
  projectPath: string;
  mrIid: number;
  mr: Awaited<ReturnType<GitLabClient["getMergeRequest"]>>;
  changes: Awaited<ReturnType<GitLabClient["getMergeRequestChanges"]>>;
  commits: Awaited<ReturnType<GitLabClient["getMergeRequestCommits"]>>;
};

type SummarizeGraphState = {
  input: ReviewWorkflowInput;
  runtime: WorkflowRuntime | null;
  llm: LlmClient | null;
  gitlab: GitLabClient | null;
  remoteContext: RemoteMrContext | null;
  result: ReviewWorkflowResult | null;
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
    const phaseReporter = createWorkflowPhaseReporter("review", state.input.events);
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
  const phaseReporter = createWorkflowPhaseReporter("review", state.input.events);
  phaseReporter.started("generate_summary", "Generating summary...");
  const output = await runLlmPrompt(prompt, llm);
  phaseReporter.completed("generate_summary", "Summary generated.");
  return {
    result: {
      output,
      inlineComments: [],
      contextLabel: `MR !${remoteContext.mrIid} (${remoteContext.projectPath})`,
      mrIid: remoteContext.mrIid,
      projectPath: remoteContext.projectPath,
      gitlabUrl: runtime.gitlabUrl,
    },
  };
}

export async function runReviewSummarizeWorkflow(
  input: ReviewWorkflowInput
): Promise<ReviewWorkflowResult> {
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
