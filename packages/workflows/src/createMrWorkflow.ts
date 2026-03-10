import { remoteToProjectPath, type GitLabClient } from "@cr/core";
import { type LlmClient } from "@cr/core";
import { getCurrentBranch, getOriginRemoteUrl } from "@cr/core";
import { logger } from "@cr/core";
import { loadPrompt } from "@cr/core";
import { createWorkflowPhaseReporter } from "./workflowEvents.js";
import {
  createRuntimeGitLabClient,
  createRuntimeLlmClient,
  loadWorkflowRuntime,
  type WorkflowRuntime,
} from "@cr/core";
import type {
  CreateMrDraft,
  CreateMrWorkflowEffect,
  CreateMrWorkflowInput,
  CreateMrWorkflowResponse,
  CreateMrWorkflowResult,
  StatusLevel,
} from "@cr/core";

type CreateMrWorkflowResponseInput = CreateMrWorkflowResponse | undefined;

const WORKFLOW_NAME = "createMr";

function reportStatus(
  input: Pick<CreateMrWorkflowInput, "status">,
  level: StatusLevel,
  message: string
): void {
  input.status?.[level](message);
}

function assertRuntime(runtime: WorkflowRuntime | null): WorkflowRuntime {
  if (!runtime) {
    throw new Error("Workflow runtime not initialized.");
  }
  return runtime;
}

function assertGitLab(gitlab: GitLabClient | null): GitLabClient {
  if (!gitlab) {
    throw new Error("GitLab client not initialized.");
  }
  return gitlab;
}

function assertLlm(llm: LlmClient | null): LlmClient {
  if (!llm) {
    throw new Error("LLM client not initialized.");
  }
  return llm;
}

function fallbackDescription(diff: string): string {
  const trimmed = diff.trim();
  if (!trimmed) {
    return "No code changes detected between source and target branches.";
  }
  const preview = trimmed.slice(0, 4000);
  return [
    "## Overview",
    "Automated description fallback was used because LLM generation failed.",
    "",
    "## Changes",
    "```diff",
    preview,
    "```",
    "",
    "## Breaking Changes",
    "No breaking changes.",
  ].join("\n");
}

function fallbackTitle(source: string, target: string): string {
  return `Merge ${source} into ${target}`.slice(0, 100);
}

function buildDraft(args: {
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
  iteration: number;
}): CreateMrDraft {
  return {
    sourceBranch: args.sourceBranch,
    targetBranch: args.targetBranch,
    title: args.title,
    description: args.description,
    iteration: args.iteration,
  };
}

function assertResponseType<T extends CreateMrWorkflowResponse["type"]>(
  response: CreateMrWorkflowResponseInput,
  expected: T
): Extract<CreateMrWorkflowResponse, { type: T }> {
  if (!response || response.type !== expected) {
    const actual = response?.type ?? "none";
    throw new Error(`Expected create-MR workflow response "${expected}", received "${actual}".`);
  }
  return response as Extract<CreateMrWorkflowResponse, { type: T }>;
}

async function initializeRuntime(): Promise<WorkflowRuntime> {
  return loadWorkflowRuntime();
}

async function initializeClients(runtime: WorkflowRuntime): Promise<{
  gitlab: GitLabClient;
  llm: LlmClient;
}> {
  if (!runtime.gitlabUrl || !runtime.gitlabKey) {
    throw new Error("Missing GitLab configuration. Run `cr init` or set GITLAB_URL/GITLAB_KEY.");
  }
  return {
    gitlab: createRuntimeGitLabClient(runtime),
    llm: createRuntimeLlmClient(runtime),
  };
}

async function resolveRepositoryContext(input: CreateMrWorkflowInput): Promise<{
  sourceBranch: string;
  projectPath: string;
}> {
  const sourceBranch = await getCurrentBranch(input.repoPath);
  const remoteUrl = await getOriginRemoteUrl(input.repoPath);
  const projectPath = remoteToProjectPath(remoteUrl);
  logger.debug("create-mr", "repo context resolved", { sourceBranch, remoteUrl, projectPath });
  return { sourceBranch, projectPath };
}

async function validateBranches(args: {
  gitlab: GitLabClient;
  projectPath: string;
  sourceBranch: string;
  inputTargetBranch?: string;
}): Promise<void> {
  const [sourceExists, targetExists] = await Promise.all([
    args.gitlab.branchExists(args.projectPath, args.sourceBranch),
    args.inputTargetBranch
      ? args.gitlab.branchExists(args.projectPath, args.inputTargetBranch)
      : Promise.resolve(true),
  ]);
  if (!sourceExists) {
    throw new Error(
      `Source branch '${args.sourceBranch}' does not exist in remote repository. Push the branch before creating a merge request.`
    );
  }
  if (args.inputTargetBranch && !targetExists) {
    throw new Error(
      `Target branch '${args.inputTargetBranch}' does not exist in remote repository.`
    );
  }
}

async function loadRemoteBranches(args: {
  input: CreateMrWorkflowInput;
  gitlab: GitLabClient;
  projectPath: string;
}): Promise<{ branches: string[]; defaultBranch: string }> {
  const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, args.input.events);
  phaseReporter.started("load_remote_branches", "Loading remote branches...");
  const [branches, rawDefaultBranch] = await Promise.all([
    args.gitlab.listBranches(args.projectPath),
    args.gitlab.getDefaultBranch(args.projectPath),
  ]);
  const defaultBranch = branches.includes(rawDefaultBranch) ? rawDefaultBranch : (branches[0] ?? "");
  logger.debug("create-mr", "branches loaded", {
    count: branches.length,
    rawDefaultBranch,
    effectiveDefaultBranch: defaultBranch,
  });
  phaseReporter.completed("load_remote_branches", "Loaded remote branches.");
  return { branches, defaultBranch };
}

async function resolveTargetBranch(args: {
  input: CreateMrWorkflowInput;
  gitlab: GitLabClient;
  projectPath: string;
  sourceBranch: string;
  branches: string[];
  defaultBranch: string;
  response: CreateMrWorkflowResponseInput;
}): Promise<string> {
  logger.debug("create-mr", "resolving target branch", {
    inputTargetBranch: args.input.targetBranch,
    defaultBranch: args.defaultBranch,
    mode: args.input.mode,
    sourceBranch: args.sourceBranch,
  });

  let targetBranch = args.input.targetBranch;
  if (!targetBranch) {
    if (args.input.mode === "ci") {
      throw new Error("CI mode requires --target-branch.");
    }
    if (!args.defaultBranch) {
      throw new Error("No remote branches found.");
    }
    const resolved = assertResponseType(args.response, "target_branch_resolved");
    targetBranch = resolved.targetBranch.trim() || args.defaultBranch;
  }

  if (!args.branches.includes(targetBranch)) {
    throw new Error(`Branch '${targetBranch}' does not exist in remote repository.`);
  }
  if (targetBranch === args.sourceBranch) {
    throw new Error("Source and target branch cannot be the same.");
  }

  if (!args.input.targetBranch) {
    const exists = await args.gitlab.branchExists(args.projectPath, targetBranch);
    if (!exists) {
      throw new Error(`Target branch '${targetBranch}' does not exist in remote repository.`);
    }
  }

  logger.debug("create-mr", `target branch resolved: ${targetBranch}`);
  return targetBranch;
}

async function getBranchDiff(args: {
  input: CreateMrWorkflowInput;
  gitlab: GitLabClient;
  projectPath: string;
  sourceBranch: string;
  targetBranch: string;
}): Promise<string> {
  const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, args.input.events);
  phaseReporter.started(
    "get_branch_diff",
    `Getting branch diff (${args.sourceBranch} -> ${args.targetBranch})...`
  );
  logger.debug("create-mr", "fetching branch diff", {
    projectPath: args.projectPath,
    sourceBranch: args.sourceBranch,
    targetBranch: args.targetBranch,
  });
  const branchDiff = await args.gitlab.compareBranches(
    args.projectPath,
    args.sourceBranch,
    args.targetBranch
  );
  phaseReporter.completed("get_branch_diff", "Branch diff retrieved.");
  if (!branchDiff.trim()) {
    throw new Error(
      `No differences found between '${args.sourceBranch}' and '${args.targetBranch}'. Ensure the source branch has commits not present on the target.`
    );
  }
  logger.debug("create-mr", `branch diff fetched, len=${branchDiff.length}`);
  return branchDiff;
}

async function generateMrDraft(args: {
  input: CreateMrWorkflowInput;
  runtime: WorkflowRuntime;
  llm: LlmClient;
  branchDiff: string;
  sourceBranch: string;
  targetBranch: string;
  feedback: string;
}): Promise<{ title: string; description: string }> {
  let description = fallbackDescription(args.branchDiff);
  let title = fallbackTitle(args.sourceBranch, args.targetBranch);
  const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, args.input.events);

  if (!args.runtime.openaiApiUrl || !args.runtime.openaiApiKey) {
    reportStatus(args.input, "warning", "LLM config missing; using fallback title/description.");
    return { title, description };
  }

  try {
    const promptTemplate = await loadPrompt("mr.txt", args.input.repoRoot);
    let prompt = promptTemplate.replace("{mr_changes}", args.branchDiff);
    if (args.feedback.trim()) {
      prompt = `Human feedback for this re-run:\n${args.feedback}\n\n${prompt}`;
    }
    phaseReporter.started("generate_mr_draft", "Generating merge request description...");
    description = await args.llm.generate(prompt);
    phaseReporter.completed("generate_mr_draft", "Merge request description generated.");

    const titlePrompt = [
      "Generate a concise GitLab merge request title (max 100 chars).",
      "Only return the title text.",
      "",
      description,
    ].join("\n");
    title = (await args.llm.generate(titlePrompt)).replaceAll("\n", " ").trim().slice(0, 100);
  } catch {
    reportStatus(
      args.input,
      "warning",
      "LLM generation failed; using fallback title/description."
    );
  }

  return { title, description };
}

async function findExistingMergeRequest(args: {
  gitlab: GitLabClient;
  projectPath: string;
  sourceBranch: string;
  targetBranch: string;
}): Promise<{ iid: number; web_url: string } | null> {
  return args.gitlab.findExistingMergeRequest(
    args.projectPath,
    args.sourceBranch,
    args.targetBranch
  );
}

async function confirmMergeRequestUpsert(args: {
  input: CreateMrWorkflowInput;
  response: CreateMrWorkflowResponseInput;
}): Promise<boolean> {
  if (typeof args.input.shouldProceed === "boolean") {
    return args.input.shouldProceed;
  }
  if (args.input.mode !== "interactive") {
    return true;
  }
  return assertResponseType(args.response, "upsert_confirmed").shouldProceed;
}

async function upsertMergeRequest(args: {
  input: CreateMrWorkflowInput;
  gitlab: GitLabClient;
  projectPath: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
  existingMr: { iid: number; web_url: string } | null;
}): Promise<CreateMrWorkflowResult> {
  const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, args.input.events);

  if (args.existingMr) {
    phaseReporter.started("upsert_merge_request", `Updating existing MR !${args.existingMr.iid}...`);
    const url = await args.gitlab.updateMergeRequest(
      args.projectPath,
      args.existingMr.iid,
      args.title,
      args.description
    );
    phaseReporter.completed("upsert_merge_request", "Merge request updated.");
    return {
      sourceBranch: args.sourceBranch,
      targetBranch: args.targetBranch,
      title: args.title,
      description: args.description,
      mergeRequestUrl: url,
      action: "updated",
    };
  }

  phaseReporter.started("upsert_merge_request", "Creating merge request...");
  const url = await args.gitlab.createMergeRequest(
    args.projectPath,
    args.sourceBranch,
    args.targetBranch,
    args.title,
    args.description
  );
  phaseReporter.completed("upsert_merge_request", "Merge request created.");
  return {
    sourceBranch: args.sourceBranch,
    targetBranch: args.targetBranch,
    title: args.title,
    description: args.description,
    mergeRequestUrl: url,
    action: "created",
  };
}

export async function* runCreateMrWorkflow(
  input: CreateMrWorkflowInput
): AsyncGenerator<CreateMrWorkflowEffect, CreateMrWorkflowResult, CreateMrWorkflowResponseInput> {
  const runtime = assertRuntime(await initializeRuntime());
  const { gitlab, llm } = await initializeClients(runtime);
  const { sourceBranch, projectPath } = await resolveRepositoryContext(input);
  await validateBranches({
    gitlab,
    projectPath,
    sourceBranch,
    inputTargetBranch: input.targetBranch,
  });

  const { branches, defaultBranch } = await loadRemoteBranches({
    input,
    gitlab: assertGitLab(gitlab),
    projectPath,
  });

  const targetBranchResponse =
    input.targetBranch || input.mode === "ci"
      ? undefined
      : yield {
          type: "resolve_target_branch",
          branches,
          defaultBranch,
        };

  const targetBranch = await resolveTargetBranch({
      input,
      gitlab: assertGitLab(gitlab),
      projectPath,
      sourceBranch,
      branches,
      defaultBranch,
      response: targetBranchResponse,
    });

  const branchDiff = await getBranchDiff({
    input,
    gitlab: assertGitLab(gitlab),
    projectPath,
    sourceBranch,
    targetBranch,
  });

  let iteration = 0;
  let feedback = input.userFeedback?.trim() ?? "";
  let title = "";
  let description = "";

  for (;;) {
    ({ title, description } = await generateMrDraft({
      input,
      runtime,
      llm: assertLlm(llm),
      branchDiff,
      sourceBranch,
      targetBranch,
      feedback,
    }));

    iteration += 1;
    const draft = buildDraft({
      sourceBranch,
      targetBranch,
      title,
      description,
      iteration,
    });

    yield {
      type: "draft_ready",
      draft,
    };

    if (input.mode !== "interactive") {
      break;
    }

    const feedbackResponse = yield {
      type: "request_draft_feedback",
      draft,
    };
    const nextFeedback =
      assertResponseType(feedbackResponse, "draft_feedback").feedback?.trim() ?? "";
    if (!nextFeedback) {
      break;
    }

    reportStatus(input, "info", "Regenerating merge request draft with your feedback...");
    feedback = nextFeedback;
  }

  const finalDraft = buildDraft({
    sourceBranch,
    targetBranch,
    title,
    description,
    iteration,
  });

  const existingMr = await findExistingMergeRequest({
    gitlab: assertGitLab(gitlab),
    projectPath,
    sourceBranch,
    targetBranch,
  });

  const shouldProceed =
    input.mode !== "interactive" || typeof input.shouldProceed === "boolean"
      ? await confirmMergeRequestUpsert({ input, response: undefined })
      : await confirmMergeRequestUpsert({
          input,
          response:
            yield {
              type: "confirm_upsert",
              draft: finalDraft,
              existingMrIid: existingMr?.iid,
            },
        });

  if (!shouldProceed) {
    return {
      sourceBranch,
      targetBranch,
      title,
      description,
      mergeRequestUrl: existingMr?.web_url,
      action: "cancelled",
    };
  }

  return upsertMergeRequest({
    input,
    gitlab: assertGitLab(gitlab),
    projectPath,
    sourceBranch,
    targetBranch,
    title,
    description,
    existingMr,
  });
}
