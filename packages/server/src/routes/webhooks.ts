import { createHmac, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { logger } from "@pv/core";
import type { ServerContext, WebhookProvider } from "../types.js";

type GitLabWebhookEvent = {
  object_kind?: string;
  object_attributes?: {
    action?: string;
    iid?: number;
  };
  project?: {
    id?: string | number;
  };
};

type GitHubWebhookEvent = {
  action?: string;
  number?: number;
  pull_request?: {
    number?: number;
    state?: string;
    draft?: boolean;
  };
  repository?: {
    full_name?: string;
  };
};

type ReviewBoardWebhookEvent = {
  event?: string;
  review_request?: {
    id?: number;
    repository?: {
      name?: string;
    };
  };
};

const SUPPORTED_REVIEW_BOARD_EVENT = "review_request_published";
const SUPPORTED_GITHUB_EVENT = "pull_request";
const SUPPORTED_GITHUB_ACTIONS = new Set([
  "opened",
  "reopened",
  "synchronize",
  "ready_for_review",
]);
const REVIEW_BOARD_SIGNATURE_HEADERS = [
  "x-reviewboard-signature",
  "x-reviewboard-signature-256",
  "x-hub-signature-256",
] as const;

function parseStructuredFormValue(value: string): unknown {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  return value;
}

function setNestedValue(target: Record<string, unknown>, key: string, value: unknown): void {
  const parts = key.split(".");
  let current: Record<string, unknown> = target;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    const existing = current[part];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

function parseFormEncodedEvent(body: string): GitLabWebhookEvent | ReviewBoardWebhookEvent {
  const params = new URLSearchParams(body);
  const payload = params.get("payload");
  if (payload) {
    return (JSON.parse(payload) as GitLabWebhookEvent | ReviewBoardWebhookEvent) ?? {};
  }

  const event: Record<string, unknown> = {};
  for (const [key, value] of params.entries()) {
    setNestedValue(event, key, parseStructuredFormValue(value));
  }

  return event as GitLabWebhookEvent | ReviewBoardWebhookEvent;
}

function parseWebhookEvent(
  body: string,
  contentType: string
): GitLabWebhookEvent | GitHubWebhookEvent | ReviewBoardWebhookEvent {
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return parseFormEncodedEvent(body);
  }

  return (JSON.parse(body) as GitLabWebhookEvent | GitHubWebhookEvent | ReviewBoardWebhookEvent) ?? {};
}

function getReviewBoardEventType(
  headerValue: string | undefined,
  event: ReviewBoardWebhookEvent
): string | undefined {
  if (headerValue?.trim()) {
    return headerValue.trim();
  }

  return typeof event.event === "string" && event.event.trim() ? event.event.trim() : undefined;
}

function normalizeSignature(rawValue: string): string {
  return rawValue
    .trim()
    .replace(/^sha(256|1)=/i, "")
    .toLowerCase();
}

function getReviewBoardSignature(headers: Headers): string | null {
  for (const header of REVIEW_BOARD_SIGNATURE_HEADERS) {
    const value = headers.get(header);
    if (value?.trim()) {
      return value;
    }
  }

  return null;
}

function verifyReviewBoardSignature(headers: Headers, body: string, secret: string): boolean {
  const provided = getReviewBoardSignature(headers);
  if (!provided) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  const normalizedProvided = normalizeSignature(provided);
  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(normalizedProvided, "hex");

  if (expectedBuffer.length === 0 || providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function verifyGitHubSignature(headers: Headers, body: string, secret: string): boolean {
  const provided = headers.get("x-hub-signature-256");
  if (!provided?.trim()) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  const normalizedProvided = normalizeSignature(provided);
  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(normalizedProvided, "hex");

  if (expectedBuffer.length === 0 || providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function isWebhookProviderEnabled(context: ServerContext, provider: WebhookProvider): boolean {
  switch (provider) {
    case "gitlab":
      return context.runtime.gitlabWebhookEnabled;
    case "github":
      return context.runtime.githubWebhookEnabled;
    case "reviewboard":
      return context.runtime.reviewboardWebhookEnabled;
  }
}

function getConfigError(context: ServerContext, provider: WebhookProvider): string | null {
  if (provider === "gitlab" && (!context.runtime.gitlabUrl || !context.runtime.gitlabKey)) {
    return "Missing GitLab configuration. Run `pv init --gitlab` or set GITLAB_URL/GITLAB_KEY.";
  }
  if (provider === "github" && !context.runtime.githubToken) {
    return "Missing GitHub configuration. Run `pv init --github` or set GITHUB_TOKEN.";
  }
  if (provider === "reviewboard" && (!context.runtime.rbUrl || !context.runtime.rbToken)) {
    return "Missing Review Board configuration. Run `pv init --rb` or set RB_URL/RB_TOKEN.";
  }
  return null;
}

async function handleWebhookRequest(
  context: ServerContext,
  provider: WebhookProvider,
  request: Request
): Promise<Response> {
  if (!context.enableWebhook || !isWebhookProviderEnabled(context, provider)) {
    return new Response("Not Found", { status: 404 });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const configError = getConfigError(context, provider);
  if (configError) {
    logger.warn("server", configError, { provider });
    return Response.json({ status: "error", provider, message: configError }, { status: 503 });
  }

  if (provider === "gitlab" && context.runtime.gitlabWebhookSecret) {
    const token = request.headers.get("x-gitlab-token");
    if (token !== context.runtime.gitlabWebhookSecret) {
      console.error("[SERVER] Forbidden: Invalid GitLab token received.");
      logger.warn("server", "Forbidden: Invalid GitLab token");
      return new Response("Forbidden", { status: 403 });
    }
  }

  const body = await request.text();
  if (!body) {
    return new Response("Empty body", { status: 400 });
  }

  try {
    if (provider === "github" && context.runtime.githubWebhookSecret) {
      if (!verifyGitHubSignature(request.headers, body, context.runtime.githubWebhookSecret)) {
        console.error("[SERVER] Forbidden: Invalid GitHub signature received.");
        logger.warn("server", "Forbidden: Invalid GitHub signature");
        return new Response("Forbidden", { status: 403 });
      }
    }

    if (provider === "reviewboard" && context.runtime.rbWebhookSecret) {
      if (!verifyReviewBoardSignature(request.headers, body, context.runtime.rbWebhookSecret)) {
        console.error("[SERVER] Forbidden: Invalid Review Board signature received.");
        logger.warn("server", "Forbidden: Invalid Review Board signature");
        return new Response("Forbidden", { status: 403 });
      }
    }

    const contentType = request.headers.get("content-type") ?? "";
    const event = parseWebhookEvent(body, contentType);

    let requestId: number | undefined;
    let projectId: string | number | undefined;

    if (provider === "gitlab") {
      const gitlabEvent = event as GitLabWebhookEvent;
      if (gitlabEvent.object_kind !== "merge_request") {
        return new Response("Ignored non-merge-request event");
      }

      const action = gitlabEvent.object_attributes?.action;
      if (action !== "open" && action !== "update" && action !== "reopen") {
        return new Response(`Ignored merge request action: ${action}`);
      }

      requestId = gitlabEvent.object_attributes?.iid;
      projectId = gitlabEvent.project?.id;
    } else if (provider === "github") {
      const githubEventName = request.headers.get("x-github-event")?.trim();
      if (githubEventName !== SUPPORTED_GITHUB_EVENT) {
        return new Response(
          githubEventName
            ? `Ignored GitHub event: ${githubEventName}`
            : "Ignored GitHub event: unknown"
        );
      }

      const githubEvent = event as GitHubWebhookEvent;
      const action = githubEvent.action;
      if (!action || !SUPPORTED_GITHUB_ACTIONS.has(action)) {
        return new Response(
          action ? `Ignored GitHub pull_request action: ${action}` : "Ignored GitHub pull_request action: unknown"
        );
      }

      if (githubEvent.pull_request?.state !== "open") {
        return new Response(
          `Ignored GitHub pull request state: ${githubEvent.pull_request?.state ?? "unknown"}`
        );
      }

      requestId = githubEvent.number ?? githubEvent.pull_request?.number;
      projectId = githubEvent.repository?.full_name;
    } else {
      const reviewBoardEvent = event as ReviewBoardWebhookEvent;
      const eventType = getReviewBoardEventType(
        request.headers.get("x-reviewboard-event") ?? undefined,
        reviewBoardEvent
      );

      if (eventType !== SUPPORTED_REVIEW_BOARD_EVENT) {
        return new Response(
          eventType
            ? `Ignored Review Board event: ${eventType}`
            : "Ignored Review Board event: unknown"
        );
      }

      const reviewRequest = reviewBoardEvent.review_request;
      if (!reviewRequest) {
        return new Response("Ignored non-review-request event");
      }

      requestId = reviewRequest.id;
      projectId = reviewRequest.repository?.name || "default";
    }

    if (!requestId) {
      console.error("[SERVER] Bad Request: Missing request ID");
      return new Response("Missing request ID", { status: 400 });
    }

    const jobId = context.workQueue.enqueue(provider, projectId || "default", requestId);
    if (!jobId) {
      console.error("[SERVER] Rejected: Queue is full");
      return Response.json({ status: "error", message: "Queue at capacity" }, { status: 503 });
    }

    console.log(
      `[SERVER] Accepted ${provider === "gitlab" ? "MR !" : "RR #"} ${requestId} from project ${projectId}. Job ID: ${jobId}`
    );

    return Response.json(
      {
        status: "accepted",
        jobId,
        message: "Review queued for processing",
        ...context.workQueue.getStatus(),
      },
      { status: 202 }
    );
  } catch (err) {
    console.error("[SERVER] Error parsing request body:", err);
    logger.error("server", "Error parsing webhook body", err);
    return new Response("Invalid JSON", { status: 400 });
  }
}

export function createWebhookRoutes(context: ServerContext): Hono {
  const app = new Hono();

  app.all("/webhook/gitlab", (c) => handleWebhookRequest(context, "gitlab", c.req.raw));
  app.all("/webhook/github", (c) => handleWebhookRequest(context, "github", c.req.raw));
  app.all("/webhook/reviewboard", (c) => handleWebhookRequest(context, "reviewboard", c.req.raw));

  return app;
}
