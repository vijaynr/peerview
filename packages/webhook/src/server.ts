import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFileSync } from "node:fs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { loadWorkflowRuntime, envOrConfig, logger } from "@cr/core";
import { WorkQueue } from "./workQueue.js";

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
const REVIEW_BOARD_SIGNATURE_HEADERS = [
  "x-reviewboard-signature",
  "x-reviewboard-signature-256",
  "x-hub-signature-256",
] as const;
const GITLAB_WEBHOOK_PATH = "/gitlab";
const REVIEW_BOARD_WEBHOOK_PATH = "/reviewboard";
const STATUS_PATH = "/status";

type WebhookProvider = "gitlab" | "reviewboard";

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
): GitLabWebhookEvent | ReviewBoardWebhookEvent {
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return parseFormEncodedEvent(body);
  }

  return (JSON.parse(body) as GitLabWebhookEvent | ReviewBoardWebhookEvent) ?? {};
}

function getReviewBoardEventType(
  req: IncomingMessage,
  event: ReviewBoardWebhookEvent
): string | undefined {
  const headerValue = req.headers["x-reviewboard-event"];
  if (typeof headerValue === "string" && headerValue.trim()) {
    return headerValue.trim();
  }

  return typeof event.event === "string" && event.event.trim() ? event.event.trim() : undefined;
}

function normalizeSignature(rawValue: string): string {
  return rawValue.trim().replace(/^sha(256|1)=/i, "").toLowerCase();
}

function getReviewBoardSignature(req: IncomingMessage): string | null {
  for (const header of REVIEW_BOARD_SIGNATURE_HEADERS) {
    const value = req.headers[header];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}

function verifyReviewBoardSignature(
  req: IncomingMessage,
  body: string,
  secret: string
): boolean {
  const provided = getReviewBoardSignature(req);
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

export async function startWebhookServer(
  port = 3000,
  options?: {
    sslCertPath?: string;
    sslKeyPath?: string;
    sslCaPath?: string;
    webhookConcurrency?: number;
    webhookQueueLimit?: number;
    webhookJobTimeoutMs?: number;
  }
) {
  const runtime = await loadWorkflowRuntime();

  if (options?.webhookConcurrency) runtime.webhookConcurrency = options.webhookConcurrency;
  if (options?.webhookQueueLimit) runtime.webhookQueueLimit = options.webhookQueueLimit;
  if (options?.webhookJobTimeoutMs) runtime.webhookJobTimeoutMs = options.webhookJobTimeoutMs;

  runtime.gitlabKey = envOrConfig("GITLAB_KEY", runtime.gitlabKey, "");
  runtime.rbToken = envOrConfig("RB_TOKEN", runtime.rbToken, "");
  runtime.gitlabWebhookSecret = envOrConfig(
    "GITLAB_WEBHOOK_SECRET",
    runtime.gitlabWebhookSecret,
    ""
  );
  runtime.rbWebhookSecret = envOrConfig("RB_WEBHOOK_SECRET", runtime.rbWebhookSecret, "");

  const sslCertPath =
    options?.sslCertPath || envOrConfig("SSL_CERT_PATH", runtime.sslCertPath, "");
  const sslKeyPath = options?.sslKeyPath || envOrConfig("SSL_KEY_PATH", runtime.sslKeyPath, "");
  const sslCaPath = options?.sslCaPath || envOrConfig("SSL_CA_PATH", runtime.sslCaPath, "");

  const workQueue = new WorkQueue(runtime);

  function resolveProvider(url: string | undefined): WebhookProvider | null {
    const pathname = new URL(url ?? "/", "http://localhost").pathname;
    if (pathname === GITLAB_WEBHOOK_PATH) {
      return "gitlab";
    }
    if (pathname === REVIEW_BOARD_WEBHOOK_PATH) {
      return "reviewboard";
    }
    return null;
  }

  function getConfigError(provider: WebhookProvider): string | null {
    if (provider === "gitlab" && (!runtime.gitlabUrl || !runtime.gitlabKey)) {
      return "Missing GitLab configuration. Run `cr init --gitlab` or set GITLAB_URL/GITLAB_KEY.";
    }
    if (provider === "reviewboard" && (!runtime.rbUrl || !runtime.rbToken)) {
      return "Missing Review Board configuration. Run `cr init --rb` or set RB_URL/RB_TOKEN.";
    }
    return null;
  }

  const requestListener = async (req: IncomingMessage, res: ServerResponse) => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    console.log(`[WEBHOOK] Incoming ${req.method} request to ${pathname}`);

    if (pathname === STATUS_PATH && req.method === "GET") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ...workQueue.getStatus(),
          routes: {
            gitlab: GITLAB_WEBHOOK_PATH,
            reviewboard: REVIEW_BOARD_WEBHOOK_PATH,
          },
        })
      );
      return;
    }

    const provider = resolveProvider(req.url);
    if (!provider) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end("Method Not Allowed");
      return;
    }

    const configError = getConfigError(provider);
    if (configError) {
      logger.warn("webhook", configError, { provider });
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ status: "error", provider, message: configError }));
      return;
    }

    if (provider === "gitlab" && runtime.gitlabWebhookSecret) {
      const token = req.headers["x-gitlab-token"];
      if (token !== runtime.gitlabWebhookSecret) {
        console.error("[WEBHOOK] Forbidden: Invalid GitLab token received.");
        logger.warn("webhook", "Forbidden: Invalid GitLab token");
        res.statusCode = 403;
        res.end("Forbidden");
        return;
      }
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        if (!body) {
          res.statusCode = 400;
          res.end("Empty body");
          return;
        }

        if (provider === "reviewboard" && runtime.rbWebhookSecret) {
          if (!verifyReviewBoardSignature(req, body, runtime.rbWebhookSecret)) {
            console.error("[WEBHOOK] Forbidden: Invalid Review Board signature received.");
            logger.warn("webhook", "Forbidden: Invalid Review Board signature");
            res.statusCode = 403;
            res.end("Forbidden");
            return;
          }
        }

        const contentType = req.headers["content-type"] || "";
        const event = parseWebhookEvent(body, contentType);

        let requestId: number | undefined;
        let projectId: string | number | undefined;

        if (provider === "gitlab") {
          const gitlabEvent = event as GitLabWebhookEvent;
          const objectKind = gitlabEvent.object_kind;
          if (objectKind !== "merge_request") {
            res.statusCode = 200;
            res.end("Ignored non-merge-request event");
            return;
          }
          const mrAttributes = gitlabEvent.object_attributes;
          const action = mrAttributes?.action;
          if (action !== "open" && action !== "update" && action !== "reopen") {
            res.statusCode = 200;
            res.end(`Ignored merge request action: ${action}`);
            return;
          }
          requestId = mrAttributes?.iid;
          projectId = gitlabEvent.project?.id;
        } else {
          const reviewBoardEvent = event as ReviewBoardWebhookEvent;
          const eventType = getReviewBoardEventType(req, reviewBoardEvent);
          if (eventType !== SUPPORTED_REVIEW_BOARD_EVENT) {
            res.statusCode = 200;
            res.end(
              eventType
                ? `Ignored Review Board event: ${eventType}`
                : "Ignored Review Board event: unknown"
            );
            return;
          }

          const rr = reviewBoardEvent.review_request;
          if (!rr) {
            res.statusCode = 200;
            res.end("Ignored non-review-request event");
            return;
          }
          requestId = rr.id;
          projectId = rr.repository?.name || "default";
        }

        if (!requestId) {
          console.error("[WEBHOOK] Bad Request: Missing request ID");
          res.statusCode = 400;
          res.end("Missing request ID");
          return;
        }

        const jobId = workQueue.enqueue(provider, projectId || "default", requestId);

        if (!jobId) {
          console.error("[WEBHOOK] Rejected: Queue is full");
          res.statusCode = 503;
          res.end(JSON.stringify({ status: "error", message: "Queue at capacity" }));
          return;
        }

        console.log(
          `[WEBHOOK] Accepted ${provider === "gitlab" ? "MR !" : "RR #"} ${requestId} from project ${projectId}. Job ID: ${jobId}`
        );

        res.statusCode = 202;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            status: "accepted",
            jobId,
            message: "Review queued for processing",
            ...workQueue.getStatus(),
          })
        );
      } catch (err) {
        console.error("[WEBHOOK] Error parsing request body:", err);
        logger.error("webhook", "Error parsing webhook body", err);
        res.statusCode = 400;
        res.end("Invalid JSON");
      }
    });
  };

  let server;
  let protocol = "http";

  if (sslCertPath && sslKeyPath) {
    try {
      const httpsOptions: Parameters<typeof createHttpsServer>[0] = {
        cert: readFileSync(sslCertPath),
        key: readFileSync(sslKeyPath),
      };
      if (sslCaPath) {
        httpsOptions.ca = readFileSync(sslCaPath);
      }
      server = createHttpsServer(httpsOptions, requestListener);
      protocol = "https";
    } catch (err) {
      logger.error("webhook", "Failed to load SSL certificates, falling back to HTTP", err);
      console.error(`[WEBHOOK] SSL Error: ${err instanceof Error ? err.message : String(err)}`);
      server = createHttpServer(requestListener);
    }
  } else {
    server = createHttpServer(requestListener);
  }

  server.listen(port, () => {
    logger.info("webhook", `Webhook server listening on port ${port} (${protocol})`);
    console.log(`[WEBHOOK] Server listening on port ${port} (${protocol})`);
    console.log(`[WEBHOOK] Endpoints:`);
    console.log(`[WEBHOOK]   POST ${protocol}://localhost:${port}${GITLAB_WEBHOOK_PATH}`);
    console.log(`[WEBHOOK]   POST ${protocol}://localhost:${port}${REVIEW_BOARD_WEBHOOK_PATH}`);
    console.log(`[WEBHOOK]   GET  ${protocol}://localhost:${port}${STATUS_PATH}`);
  });

  return server;
}
