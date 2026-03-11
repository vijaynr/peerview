import {
  remoteToProjectPath,
  type GitLabClient,
  type LlmClient,
  getCurrentBranch,
  getOriginRemoteUrl,
  logger,
  loadPrompt,
  createRuntimeGitLabClient,
  createRuntimeLlmClient,
  createRuntimeReviewBoardClient,
  loadWorkflowRuntime,
  isSvnWorkingCopy,
  getSvnDiff,
  getSvnRepoRootUrl,
  getSvnWorkingCopyUrl,
  type ReviewBoardClient,
  type ReviewBoardRepository,
  type WorkflowRuntime,
} from "@cr/core";
import type {
  CreateReviewDraft,
  CreateReviewProvider,
  CreateReviewWorkflowEffect,
  CreateReviewWorkflowInput,
  CreateReviewWorkflowResponse,
  CreateReviewWorkflowResult,
  StatusLevel,
} from "@cr/core";
import { createWorkflowPhaseReporter } from "./workflowEvents.js";

type CreateReviewWorkflowResponseInput = CreateReviewWorkflowResponse | undefined;
const WORKFLOW_NAME = "createReview";

function reportStatus(
  input: Pick<CreateReviewWorkflowInput, "status">,
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

function assertReviewBoard(rb: ReviewBoardClient | null): ReviewBoardClient {
  if (!rb) {
    throw new Error("Review Board client not initialized.");
  }
  return rb;
}

function assertLlm(llm: LlmClient | null): LlmClient {
  if (!llm) {
    throw new Error("LLM client not initialized.");
  }
  return llm;
}

function getProvider(input: CreateReviewWorkflowInput): CreateReviewProvider {
  return input.provider ?? "gitlab";
}

function fallbackDescription(entityLabel: string, diff: string): string {
  const trimmed = diff.trim();
  if (!trimmed) {
    return `No code changes detected for this ${entityLabel}.`;
  }
  const preview = trimmed.slice(0, 4000);
  return [
    "## Overview",
    `Automated ${entityLabel} description fallback was used because LLM generation failed.`,
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

function fallbackTitle(provider: CreateReviewProvider, sourceLabel: string, targetLabel?: string): string {
  if (provider === "reviewboard") {
    return `Review changes from ${sourceLabel}`.slice(0, 100);
  }
  return `Merge ${sourceLabel} into ${targetLabel ?? "target"}`.slice(0, 100);
}

function buildDraft(args: {
  provider: CreateReviewProvider;
  sourceLabel: string;
  targetLabel?: string;
  title: string;
  description: string;
  iteration: number;
}): CreateReviewDraft {
  return {
    provider: args.provider,
    sourceLabel: args.sourceLabel,
    targetLabel: args.targetLabel,
    title: args.title,
    description: args.description,
    iteration: args.iteration,
  };
}

function assertResponseType<T extends CreateReviewWorkflowResponse["type"]>(
  response: CreateReviewWorkflowResponseInput,
  expected: T
): Extract<CreateReviewWorkflowResponse, { type: T }> {
  if (!response || response.type !== expected) {
    const actual = response?.type ?? "none";
    throw new Error(`Expected create-review workflow response "${expected}", received "${actual}".`);
  }
  return response as Extract<CreateReviewWorkflowResponse, { type: T }>;
}

async function initializeRuntime(): Promise<WorkflowRuntime> {
  return loadWorkflowRuntime();
}

async function initializeGitLabClients(runtime: WorkflowRuntime): Promise<{
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

async function initializeReviewBoardClients(runtime: WorkflowRuntime): Promise<{
  rb: ReviewBoardClient;
  llm: LlmClient;
}> {
  if (!runtime.rbUrl || !runtime.rbToken) {
    throw new Error("Missing Review Board configuration. Run `cr init --rb` or set RB_URL/RB_TOKEN.");
  }
  return {
    rb: createRuntimeReviewBoardClient(runtime),
    llm: createRuntimeLlmClient(runtime),
  };
}

async function resolveGitLabRepositoryContext(input: CreateReviewWorkflowInput): Promise<{
  sourceBranch: string;
  projectPath: string;
}> {
  const sourceBranch = await getCurrentBranch(input.repoPath);
  const remoteUrl = await getOriginRemoteUrl(input.repoPath);
  const projectPath = remoteToProjectPath(remoteUrl);
  logger.debug("create-review", "gitlab repo context resolved", { sourceBranch, remoteUrl, projectPath });
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
    throw new Error(`Target branch '${args.inputTargetBranch}' does not exist in remote repository.`);
  }
}

async function loadRemoteBranches(args: {
  input: CreateReviewWorkflowInput;
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
  phaseReporter.completed("load_remote_branches", "Loaded remote branches.");
  return { branches, defaultBranch };
}

async function resolveTargetBranch(args: {
  input: CreateReviewWorkflowInput;
  gitlab: GitLabClient;
  projectPath: string;
  sourceBranch: string;
  branches: string[];
  defaultBranch: string;
  response: CreateReviewWorkflowResponseInput;
}): Promise<string> {
  let targetBranch = args.input.targetBranch;
  if (!targetBranch) {
    if (args.input.mode === "ci") {
      throw new Error("CI mode requires --target-branch for GitLab create-review.");
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

  return targetBranch;
}

async function getBranchDiff(args: {
  input: CreateReviewWorkflowInput;
  gitlab: GitLabClient;
  projectPath: string;
  sourceBranch: string;
  targetBranch: string;
}): Promise<string> {
  const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, args.input.events);
  phaseReporter.started("get_branch_diff", `Getting branch diff (${args.sourceBranch} -> ${args.targetBranch})...`);
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
  return branchDiff;
}

async function generateDraft(args: {
  input: CreateReviewWorkflowInput;
  runtime: WorkflowRuntime;
  llm: LlmClient;
  provider: CreateReviewProvider;
  diff: string;
  sourceLabel: string;
  targetLabel?: string;
  feedback: string;
}): Promise<{ title: string; description: string }> {
  const entityLabel = args.provider === "reviewboard" ? "review request" : "merge request";
  let description = fallbackDescription(entityLabel, args.diff);
  let title = fallbackTitle(args.provider, args.sourceLabel, args.targetLabel);
  const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, args.input.events);

  if (!args.runtime.openaiApiUrl || !args.runtime.openaiApiKey) {
    reportStatus(args.input, "warning", `LLM config missing; using fallback ${entityLabel} title/description.`);
    return { title, description };
  }

  try {
    const promptTemplate = await loadPrompt("mr.txt", args.input.repoRoot);
    let prompt = promptTemplate.replace("{mr_changes}", args.diff);
    if (args.feedback.trim()) {
      prompt = `Human feedback for this re-run:\n${args.feedback}\n\n${prompt}`;
    }
    phaseReporter.started("generate_mr_draft", `Generating ${entityLabel} description...`);
    description = await args.llm.generate(prompt);
    phaseReporter.completed("generate_mr_draft", `${entityLabel[0]!.toUpperCase()}${entityLabel.slice(1)} description generated.`);

    const titlePrompt = [
      `Generate a concise ${entityLabel} title (max 100 chars).`,
      "Only return the title text.",
      "",
      description,
    ].join("\n");
    title = (await args.llm.generate(titlePrompt)).replaceAll("\n", " ").trim().slice(0, 100);
  } catch {
    reportStatus(
      args.input,
      "warning",
      `LLM generation failed; using fallback ${entityLabel} title/description.`
    );
  }

  return { title, description };
}

async function confirmUpsert(args: {
  input: CreateReviewWorkflowInput;
  response: CreateReviewWorkflowResponseInput;
}): Promise<boolean> {
  if (typeof args.input.shouldProceed === "boolean") {
    return args.input.shouldProceed;
  }
  if (args.input.mode !== "interactive") {
    return true;
  }
  return assertResponseType(args.response, "upsert_confirmed").shouldProceed;
}

async function findExistingMergeRequest(args: {
  gitlab: GitLabClient;
  projectPath: string;
  sourceBranch: string;
  targetBranch: string;
}): Promise<{ iid: number; web_url: string } | null> {
  return args.gitlab.findExistingMergeRequest(args.projectPath, args.sourceBranch, args.targetBranch);
}

async function upsertMergeRequest(args: {
  input: CreateReviewWorkflowInput;
  gitlab: GitLabClient;
  projectPath: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
  existingMr: { iid: number; web_url: string } | null;
}): Promise<CreateReviewWorkflowResult> {
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
      provider: "gitlab",
      entityType: "merge_request",
      entityId: args.existingMr.iid,
      sourceLabel: args.sourceBranch,
      targetLabel: args.targetBranch,
      title: args.title,
      description: args.description,
      url,
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
    provider: "gitlab",
    entityType: "merge_request",
    sourceLabel: args.sourceBranch,
    targetLabel: args.targetBranch,
    title: args.title,
    description: args.description,
    url,
    action: "created",
  };
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function getRepositoryPaths(repository: ReviewBoardRepository): string[] {
  return [repository.path, repository.mirror_path]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeUrl(value));
}

function tryGetBasedir(repositoryPath: string, workingCopyUrl: string): string | null {
  const repoUrl = new URL(normalizeUrl(repositoryPath));
  const workUrl = new URL(normalizeUrl(workingCopyUrl));

  if (repoUrl.origin !== workUrl.origin) {
    return null;
  }

  const repoPathname = repoUrl.pathname.replace(/\/+$/, "");
  const workPathname = workUrl.pathname.replace(/\/+$/, "");
  if (workPathname === repoPathname) {
    return "";
  }
  if (!workPathname.startsWith(`${repoPathname}/`)) {
    return null;
  }

  const suffix = workPathname.slice(repoPathname.length);
  return suffix || "";
}

function resolveRepositoryMatch(args: {
  repositories: ReviewBoardRepository[];
  configuredRepositoryUrl?: string;
  repoRootUrl: string;
  workingCopyUrl: string;
}): { repository: ReviewBoardRepository; basedir?: string } {
  const configuredUrl = args.configuredRepositoryUrl ? normalizeUrl(args.configuredRepositoryUrl) : undefined;
  const repoRootUrl = normalizeUrl(args.repoRootUrl);
  const workingCopyUrl = normalizeUrl(args.workingCopyUrl);

  const candidates = args.repositories
    .map((repository) => {
      const paths = getRepositoryPaths(repository);
      const exactScore = paths.some((path) => path === configuredUrl)
        ? 3
        : paths.some((path) => path === repoRootUrl)
          ? 2
          : paths.some((path) => path === workingCopyUrl)
            ? 1
            : 0;
      const basedirs = paths
        .map((path) => ({ path, basedir: tryGetBasedir(path, workingCopyUrl) }))
        .filter((item): item is { path: string; basedir: string } => item.basedir !== null)
        .sort((a, b) => b.path.length - a.path.length);

      const bestBasedir = basedirs[0];
      const score = exactScore > 0 ? exactScore + 1000 : bestBasedir ? bestBasedir.path.length : 0;
      return {
        repository,
        basedir: bestBasedir?.basedir,
        score,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    throw new Error(
      "Could not resolve a Review Board repository for this SVN working copy. Check SVN_REPOSITORY_URL / svnRepositoryUrl and Review Board repository configuration."
    );
  }

  if (candidates.length > 1 && candidates[0]!.score === candidates[1]!.score) {
    throw new Error(
      "Multiple Review Board repositories match this SVN working copy. Narrow svnRepositoryUrl or Review Board repository paths before using --rb."
    );
  }

  return {
    repository: candidates[0]!.repository,
    basedir: candidates[0]!.basedir || undefined,
  };
}

async function resolveReviewBoardRepository(args: {
  input: CreateReviewWorkflowInput;
  runtime: WorkflowRuntime;
  rb: ReviewBoardClient;
}): Promise<{
  repository: ReviewBoardRepository;
  basedir?: string;
  workingCopyUrl: string;
}> {
  const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, args.input.events);
  phaseReporter.started("resolve_reviewboard_repository", "Resolving Review Board repository...");

  const [repositories, repoRootUrl, workingCopyUrl] = await Promise.all([
    args.rb.listRepositories(),
    getSvnRepoRootUrl(args.input.repoPath),
    getSvnWorkingCopyUrl(args.input.repoPath),
  ]);

  const match = resolveRepositoryMatch({
    repositories,
    configuredRepositoryUrl: args.runtime.svnRepositoryUrl,
    repoRootUrl,
    workingCopyUrl,
  });

  phaseReporter.completed("resolve_reviewboard_repository", "Resolved Review Board repository.");
  return {
    repository: match.repository,
    basedir: match.basedir,
    workingCopyUrl,
  };
}

async function createReviewBoardRequest(args: {
  input: CreateReviewWorkflowInput;
  rb: ReviewBoardClient;
  repositoryId: number;
  diff: string;
  basedir?: string;
  title: string;
  description: string;
  sourceLabel: string;
}): Promise<CreateReviewWorkflowResult> {
  const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, args.input.events);

  phaseReporter.started("create_review_request", "Creating review request...");
  const request = await args.rb.createReviewRequest(args.repositoryId);
  phaseReporter.completed("create_review_request", `Created review request #${request.id}.`);

  phaseReporter.started("upload_review_diff", "Uploading SVN diff to Review Board...");
  await args.rb.uploadReviewRequestDiff(request.id, args.diff, args.basedir);
  phaseReporter.completed("upload_review_diff", "Uploaded SVN diff.");

  phaseReporter.started("publish_review_request", "Publishing review request...");
  await args.rb.updateReviewRequestDraft(request.id, {
    summary: args.title,
    description: args.description,
  });
  const published = await args.rb.publishReviewRequest(request.id);
  phaseReporter.completed("publish_review_request", "Review request published.");

  return {
    provider: "reviewboard",
    entityType: "review_request",
    entityId: request.id,
    sourceLabel: args.sourceLabel,
    title: args.title,
    description: args.description,
    url: published.absolute_url || request.absolute_url,
    action: "created",
  };
}

async function* runGitLabCreateReviewWorkflow(
  input: CreateReviewWorkflowInput
): AsyncGenerator<CreateReviewWorkflowEffect, CreateReviewWorkflowResult, CreateReviewWorkflowResponseInput> {
  const runtime = assertRuntime(await initializeRuntime());
  const { gitlab, llm } = await initializeGitLabClients(runtime);
  const { sourceBranch, projectPath } = await resolveGitLabRepositoryContext(input);
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
    ({ title, description } = await generateDraft({
      input,
      runtime,
      llm: assertLlm(llm),
      provider: "gitlab",
      diff: branchDiff,
      sourceLabel: sourceBranch,
      targetLabel: targetBranch,
      feedback,
    }));

    iteration += 1;
    const draft = buildDraft({
      provider: "gitlab",
      sourceLabel: sourceBranch,
      targetLabel: targetBranch,
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
    const nextFeedback = assertResponseType(feedbackResponse, "draft_feedback").feedback?.trim() ?? "";
    if (!nextFeedback) {
      break;
    }

    reportStatus(input, "info", "Regenerating merge request draft with your feedback...");
    feedback = nextFeedback;
  }

  const finalDraft = buildDraft({
    provider: "gitlab",
    sourceLabel: sourceBranch,
    targetLabel: targetBranch,
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
      ? await confirmUpsert({ input, response: undefined })
      : await confirmUpsert({
          input,
          response:
            yield {
              type: "confirm_upsert",
              draft: finalDraft,
              entityType: "merge_request",
              existingEntityId: existingMr?.iid,
            },
        });

  if (!shouldProceed) {
    return {
      provider: "gitlab",
      entityType: "merge_request",
      entityId: existingMr?.iid,
      sourceLabel: sourceBranch,
      targetLabel: targetBranch,
      title,
      description,
      url: existingMr?.web_url,
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

async function* runReviewBoardCreateReviewWorkflow(
  input: CreateReviewWorkflowInput
): AsyncGenerator<CreateReviewWorkflowEffect, CreateReviewWorkflowResult, CreateReviewWorkflowResponseInput> {
  if (input.targetBranch) {
    throw new Error("--target-branch is only supported for GitLab create-review.");
  }

  const runtime = assertRuntime(await initializeRuntime());
  const { rb, llm } = await initializeReviewBoardClients(runtime);

  if (!(await isSvnWorkingCopy(input.repoPath))) {
    throw new Error("Review Board create-review currently requires an SVN working copy.");
  }

  const diff = await getSvnDiff(input.repoPath);
  if (!diff.trim()) {
    throw new Error("No local SVN changes found to create a review request.");
  }

  const { repository, basedir, workingCopyUrl } = await resolveReviewBoardRepository({
    input,
    runtime,
    rb: assertReviewBoard(rb),
  });

  let iteration = 0;
  let feedback = input.userFeedback?.trim() ?? "";
  let title = "";
  let description = "";

  for (;;) {
    ({ title, description } = await generateDraft({
      input,
      runtime,
      llm: assertLlm(llm),
      provider: "reviewboard",
      diff,
      sourceLabel: workingCopyUrl,
      feedback,
    }));

    iteration += 1;
    const draft = buildDraft({
      provider: "reviewboard",
      sourceLabel: workingCopyUrl,
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
    const nextFeedback = assertResponseType(feedbackResponse, "draft_feedback").feedback?.trim() ?? "";
    if (!nextFeedback) {
      break;
    }

    reportStatus(input, "info", "Regenerating review request draft with your feedback...");
    feedback = nextFeedback;
  }

  const finalDraft = buildDraft({
    provider: "reviewboard",
    sourceLabel: workingCopyUrl,
    title,
    description,
    iteration,
  });

  const shouldProceed =
    input.mode !== "interactive" || typeof input.shouldProceed === "boolean"
      ? await confirmUpsert({ input, response: undefined })
      : await confirmUpsert({
          input,
          response:
            yield {
              type: "confirm_upsert",
              draft: finalDraft,
              entityType: "review_request",
            },
        });

  if (!shouldProceed) {
    return {
      provider: "reviewboard",
      entityType: "review_request",
      sourceLabel: workingCopyUrl,
      title,
      description,
      action: "cancelled",
    };
  }

  if (!repository.id) {
    throw new Error("Resolved Review Board repository is missing an id.");
  }

  return createReviewBoardRequest({
    input,
    rb: assertReviewBoard(rb),
    repositoryId: repository.id,
    diff,
    basedir,
    title,
    description,
    sourceLabel: workingCopyUrl,
  });
}

export async function* runCreateReviewWorkflow(
  input: CreateReviewWorkflowInput
): AsyncGenerator<CreateReviewWorkflowEffect, CreateReviewWorkflowResult, CreateReviewWorkflowResponseInput> {
  if (getProvider(input) === "reviewboard") {
    return yield* runReviewBoardCreateReviewWorkflow({
      ...input,
      provider: "reviewboard",
    });
  }

  return yield* runGitLabCreateReviewWorkflow({
    ...input,
    provider: "gitlab",
  });
}


