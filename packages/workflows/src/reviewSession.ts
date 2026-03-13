import {
  envOrConfig,
  getCurrentUser as rbGetCurrentUser,
  getOriginRemoteUrl,
  listMergeRequests,
  listReviewRequests as rbListRequests,
  loadCRConfig,
  rbRequest,
  remoteToProjectPath,
  listBundledReviewAgentNames,
  normalizeReviewAgentNames,
  type MergeRequestState,
  type ReviewAgentSelectionOption,
  type ReviewBoardRequest,
  type ReviewSessionEffect,
  type ReviewSessionResponse,
  type ReviewSessionResult,
  type ReviewSelectionOption,
  type ReviewWorkflowInput,
} from "@cr/core";
import { answerReviewChatQuestion, runReviewChatWorkflow } from "./reviewChatWorkflow.js";
import { runInteractiveReviewBoardWorkflow } from "./reviewBoardWorkflow.js";
import { runInteractiveReviewWorkflow } from "./reviewWorkflow.js";
import { runReviewSummarizeWorkflow } from "./reviewSummarizeWorkflow.js";

type ReviewSessionResponseInput = ReviewSessionResponse | undefined;
const GITLAB_MR_URL_PATTERN = /\/-\/merge_requests\/(\d+)(?:[/?#]|$)/i;

function assertResponseType<T extends ReviewSessionResponse["type"]>(
  response: ReviewSessionResponseInput,
  expected: T
): Extract<ReviewSessionResponse, { type: T }> {
  if (!response || response.type !== expected) {
    const actual = response?.type ?? "none";
    throw new Error(`Expected review session response "${expected}", received "${actual}".`);
  }
  return response as Extract<ReviewSessionResponse, { type: T }>;
}

function getReviewBoardStatusMap(
  state: MergeRequestState
): "pending" | "submitted" | "all" {
  const rbStatusMap: Record<MergeRequestState, "pending" | "submitted" | "all"> = {
    opened: "pending",
    closed: "all",
    merged: "submitted",
    all: "all",
  };
  return rbStatusMap[state] || "pending";
}

function formatReviewAgentTitle(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getReviewAgentDescription(name: string): string {
  switch (name) {
    case "general":
      return "Checks correctness, reliability, tests, and overall code quality.";
    case "security":
      return "Focuses on auth, secrets, permissions, validation, and exploit risks.";
    case "clean-code":
      return "Looks for readability, maintainability, duplication, and refactor opportunities.";
    case "performance":
      return "Checks hot paths, query patterns, rendering churn, and likely runtime regressions.";
    case "test-quality":
      return "Looks for missing coverage, weak assertions, flaky tests, and untested edge cases.";
    default:
      return "Runs a specialized review prompt for this agent.";
  }
}

async function loadReviewAgentSelectionOptions(
  input: ReviewWorkflowInput
): Promise<ReviewAgentSelectionOption[]> {
  const config = await loadCRConfig();
  const defaultAgents = normalizeReviewAgentNames(input.agentNames ?? config.defaultReviewAgents);
  const availableAgents = Array.from(
    new Set([...listBundledReviewAgentNames(), ...defaultAgents])
  ).sort();

  return availableAgents.map((name) => ({
    title: formatReviewAgentTitle(name),
    value: name,
    description: getReviewAgentDescription(name),
    selected: defaultAgents.includes(name),
  }));
}

async function loadReviewBoardSelectionOptions(
  input: ReviewWorkflowInput
): Promise<ReviewSelectionOption[]> {
  const config = await loadCRConfig();
  const rbUrl = envOrConfig("RB_URL", config.rbUrl, "");
  const rbToken = envOrConfig("RB_TOKEN", config.rbToken, "");
  if (!rbUrl || !rbToken) {
    throw new Error(
      "Missing Review Board configuration. Run `cr init --rb` or set RB_URL/RB_TOKEN."
    );
  }

  const status = getReviewBoardStatusMap(input.state);
  let requests = await rbListRequests(rbUrl, rbToken, status, input.fromUser);

  if (requests.length === 0 && !input.fromUser && input.state === "opened") {
    const user = await rbGetCurrentUser(rbUrl, rbToken);
    const outgoing = await rbListRequests(rbUrl, rbToken, "pending", user.username);

    const incomingDirectUrl = `/api/review-requests/?status=pending&to-users-directly=${encodeURIComponent(user.username)}&expand=submitter`;
    const incomingDirectResp = await rbRequest<{ review_requests: ReviewBoardRequest[] }>(
      rbUrl,
      rbToken,
      incomingDirectUrl
    );

    const incomingGroupsUrl = `/api/review-requests/?status=pending&to-users=${encodeURIComponent(user.username)}&expand=submitter`;
    const incomingGroupsResp = await rbRequest<{ review_requests: ReviewBoardRequest[] }>(
      rbUrl,
      rbToken,
      incomingGroupsUrl
    );

    const seenIds = new Set<number>();
    requests = [...outgoing, ...(incomingDirectResp.review_requests ?? []), ...(incomingGroupsResp.review_requests ?? [])].filter(
      (request) => {
        if (seenIds.has(request.id)) {
          return false;
        }
        seenIds.add(request.id);
        return true;
      }
    );
  }

  if (requests.length === 0) {
    throw new Error(`No ${status} review requests found.`);
  }

  return requests.map((request) => ({
    title: `#${request.id} [by ${request.submitter?.username || "unknown"}] ${request.summary}`,
    value: request.id,
  }));
}

async function loadGitLabSelectionOptions(
  input: ReviewWorkflowInput
): Promise<ReviewSelectionOption[]> {
  const config = await loadCRConfig();
  const gitlabUrl = envOrConfig("GITLAB_URL", config.gitlabUrl, "");
  const gitlabKey = envOrConfig("GITLAB_KEY", config.gitlabKey, "");
  if (!gitlabUrl || !gitlabKey) {
    throw new Error("Missing GitLab configuration. Run `cr init` or set GITLAB_URL/GITLAB_KEY.");
  }

  const repoUrl = input.url ?? (await getOriginRemoteUrl(input.repoPath));
  const projectPath = remoteToProjectPath(repoUrl);
  const mergeRequests = await listMergeRequests(gitlabUrl, gitlabKey, projectPath, input.state);
  if (mergeRequests.length === 0) {
    throw new Error("No merge requests found.");
  }

  return mergeRequests.map((mr) => ({
    title: `!${mr.iid} [${mr.state}] ${mr.title}`,
    value: mr.iid,
  }));
}

function getReviewStartMessage(input: ReviewWorkflowInput): string | null {
  if (input.workflow === "summarize") {
    return null;
  }
  if (input.workflow === "review") {
    return input.provider === "reviewboard"
      ? "Do you want to run the code review for this review request?"
      : "Do you want to run the code review for this merge request?";
  }
  return "Do you want to ask questions about this merge request?";
}

function tryParseMergeRequestIidFromUrl(url: string | undefined): number | null {
  if (!url) {
    return null;
  }

  const match = url.match(GITLAB_MR_URL_PATTERN);
  if (!match) {
    return null;
  }

  const mrIid = Number(match[1]);
  return Number.isFinite(mrIid) ? mrIid : null;
}

export async function* runInteractiveReviewSession(
  input: ReviewWorkflowInput
): AsyncGenerator<ReviewSessionEffect, ReviewSessionResult, ReviewSessionResponseInput> {
  const resolvedInput: ReviewWorkflowInput = { ...input };

  if (
    resolvedInput.provider !== "reviewboard" &&
    !(typeof resolvedInput.mrIid === "number" && Number.isFinite(resolvedInput.mrIid))
  ) {
    const explicitMrIid = tryParseMergeRequestIidFromUrl(resolvedInput.url);
    if (explicitMrIid !== null) {
      resolvedInput.mrIid = explicitMrIid;
    }
  }

  if (!resolvedInput.local && resolvedInput.mode === "interactive") {
    if (!(typeof resolvedInput.mrIid === "number" && Number.isFinite(resolvedInput.mrIid))) {
      const provider = resolvedInput.provider ?? "gitlab";
      const options =
        provider === "reviewboard"
          ? await loadReviewBoardSelectionOptions(resolvedInput)
          : await loadGitLabSelectionOptions(resolvedInput);

      const selection = assertResponseType(
        yield {
          type: "select_review_target",
          provider,
          message:
            provider === "reviewboard"
              ? "Select review request (type to search)"
              : "Select merge request (type to search)",
          options,
        },
        "review_target_selected"
      );
      if (!selection.mrIid) {
        return {
          action: "cancelled",
          message:
            provider === "reviewboard"
              ? "Review request selection cancelled."
              : "Merge request selection cancelled.",
        };
      }
      resolvedInput.mrIid = selection.mrIid;
    }
  }

  if (resolvedInput.workflow === "review") {
    if (resolvedInput.mode === "interactive") {
      const agentOptions = await loadReviewAgentSelectionOptions(resolvedInput);
      const selectedAgents = assertResponseType(
        yield {
          type: "select_review_agents",
          message: "Select review agents",
          options: agentOptions,
        },
        "review_agents_selected"
      );
      if (!selectedAgents.agentNames || selectedAgents.agentNames.length === 0) {
        return {
          action: "cancelled",
          message: "Review agent selection cancelled.",
        };
      }
      resolvedInput.agentNames = normalizeReviewAgentNames(selectedAgents.agentNames);
    } else {
      const config = await loadCRConfig();
      resolvedInput.agentNames = normalizeReviewAgentNames(
        resolvedInput.agentNames ?? config.defaultReviewAgents
      );
    }

    resolvedInput.agentMode = resolvedInput.agentNames.length > 1 ? "multi" : "single";
  }

  if (!resolvedInput.agentNames?.length && resolvedInput.workflow === "review") {
    resolvedInput.agentNames = normalizeReviewAgentNames();
    resolvedInput.agentMode = "single";
  }

  if (!resolvedInput.local && resolvedInput.mode === "interactive") {
    const startMessage = getReviewStartMessage(resolvedInput);
    if (startMessage) {
      const confirmation = assertResponseType(
        yield {
          type: "confirm_review_start",
          message: startMessage,
        },
        "review_action_confirmed"
      );
      if (!confirmation.confirmed) {
        return {
          action: "cancelled",
          message: "Status: Cancelled.",
        };
      }
    }
  }

  if (resolvedInput.workflow === "chat") {
    const context = await runReviewChatWorkflow(resolvedInput);
    return {
      action: "chat",
      context,
    };
  }

  if (resolvedInput.workflow === "summarize") {
    const result = await runReviewSummarizeWorkflow(resolvedInput);
    return {
      action: "summary",
      result,
    };
  }

  const reviewSession =
    resolvedInput.provider === "reviewboard"
      ? runInteractiveReviewBoardWorkflow(resolvedInput)
      : runInteractiveReviewWorkflow(resolvedInput);

  let step = await reviewSession.next();
  while (!step.done) {
    const response = yield step.value;
    step = await reviewSession.next(
      response?.type === "review_feedback" ? response : undefined
    );
  }

  return {
    action: "review",
    result: step.value,
  };
}

export { answerReviewChatQuestion };
