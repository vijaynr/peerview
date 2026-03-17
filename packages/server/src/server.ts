import { createHmac, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { envOrConfig, loadDashboardData, loadWorkflowRuntime, logger } from "@cr/core";
import {
  getWebAppHtml,
  readWebAppScript,
  WEB_APP_DASHBOARD_ROUTE,
  WEB_APP_SCRIPT_ROUTE,
} from "@cr/web";
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

type WebhookProvider = "gitlab" | "reviewboard";

export type ServerOptions = {
  enableWeb?: boolean;
  enableWebhook?: boolean;
  repoPath?: string;
  sslCertPath?: string;
  sslKeyPath?: string;
  sslCaPath?: string;
  webhookConcurrency?: number;
  webhookQueueLimit?: number;
  webhookJobTimeoutMs?: number;
};

export type ServerHandle = {
  port: number;
  protocol: "http" | "https";
  url: URL;
  close: () => void;
  stop: (closeActiveConnections?: boolean) => void;
  readonly bunServer: Bun.Server<undefined>;
};

type ServerContext = {
  enableWeb: boolean;
  enableWebhook: boolean;
  protocol: "http" | "https";
  repoPath: string;
  runtime: Awaited<ReturnType<typeof loadWorkflowRuntime>>;
  webAppHtml: string;
  webAppScript: string;
  workQueue: WorkQueue;
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

function getConfigError(context: ServerContext, provider: WebhookProvider): string | null {
  if (provider === "gitlab" && (!context.runtime.gitlabUrl || !context.runtime.gitlabKey)) {
    return "Missing GitLab configuration. Run `cr init --gitlab` or set GITLAB_URL/GITLAB_KEY.";
  }
  if (provider === "reviewboard" && (!context.runtime.rbUrl || !context.runtime.rbToken)) {
    return "Missing Review Board configuration. Run `cr init --rb` or set RB_URL/RB_TOKEN.";
  }
  return null;
}

async function handleDashboardRequest(context: ServerContext): Promise<Response> {
  try {
    const dashboard = await loadDashboardData({ repoPath: context.repoPath });
    return Response.json(dashboard, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
      }
    );
  }
}

async function handleWebhookRequest(
  context: ServerContext,
  provider: WebhookProvider,
  request: Request
): Promise<Response> {
  if (!context.enableWebhook) {
    return new Response("Not Found", { status: 404 });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const configError = getConfigError(context, provider);
  if (configError) {
    logger.warn("webhook", configError, { provider });
    return Response.json(
      {
        status: "error",
        provider,
        message: configError,
      },
      {
        status: 503,
      }
    );
  }

  if (provider === "gitlab" && context.runtime.gitlabWebhookSecret) {
    const token = request.headers.get("x-gitlab-token");
    if (token !== context.runtime.gitlabWebhookSecret) {
      console.error("[WEBHOOK] Forbidden: Invalid GitLab token received.");
      logger.warn("webhook", "Forbidden: Invalid GitLab token");
      return new Response("Forbidden", { status: 403 });
    }
  }

  const body = await request.text();
  if (!body) {
    return new Response("Empty body", { status: 400 });
  }

  try {
    if (provider === "reviewboard" && context.runtime.rbWebhookSecret) {
      if (!verifyReviewBoardSignature(request.headers, body, context.runtime.rbWebhookSecret)) {
        console.error("[WEBHOOK] Forbidden: Invalid Review Board signature received.");
        logger.warn("webhook", "Forbidden: Invalid Review Board signature");
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
      console.error("[WEBHOOK] Bad Request: Missing request ID");
      return new Response("Missing request ID", { status: 400 });
    }

    const jobId = context.workQueue.enqueue(provider, projectId || "default", requestId);
    if (!jobId) {
      console.error("[WEBHOOK] Rejected: Queue is full");
      return Response.json(
        {
          status: "error",
          message: "Queue at capacity",
        },
        {
          status: 503,
        }
      );
    }

    console.log(
      `[WEBHOOK] Accepted ${provider === "gitlab" ? "MR !" : "RR #"} ${requestId} from project ${projectId}. Job ID: ${jobId}`
    );

    return Response.json(
      {
        status: "accepted",
        jobId,
        message: "Review queued for processing",
        ...context.workQueue.getStatus(),
      },
      {
        status: 202,
      }
    );
  } catch (err) {
    console.error("[WEBHOOK] Error parsing request body:", err);
    logger.error("webhook", "Error parsing webhook body", err);
    return new Response("Invalid JSON", { status: 400 });
  }
}

function createServerApp(context: ServerContext): Hono {
  const app = new Hono();

  app.use(async (c, next) => {
    console.log(`[WEBHOOK] Incoming ${c.req.method} request to ${c.req.path}`);
    await next();
  });

  app.get(STATUS_PATH, (c) =>
    c.json({
      ...context.workQueue.getStatus(),
      routes: {
        ...(context.enableWebhook
          ? {
              gitlab: GITLAB_WEBHOOK_PATH,
              reviewboard: REVIEW_BOARD_WEBHOOK_PATH,
            }
          : {}),
        ...(context.enableWeb
          ? {
              web: "/",
              dashboard: WEB_APP_DASHBOARD_ROUTE,
            }
          : {}),
      },
    })
  );

  app.get(WEB_APP_DASHBOARD_ROUTE, async (c) => {
    if (!context.enableWeb) {
      return c.notFound();
    }

    return handleDashboardRequest(context);
  });

  app.get(WEB_APP_SCRIPT_ROUTE, (c) => {
    if (!context.enableWeb) {
      return c.notFound();
    }

    return new Response(context.webAppScript, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  });

  app.all(GITLAB_WEBHOOK_PATH, (c) => handleWebhookRequest(context, "gitlab", c.req.raw));
  app.all(REVIEW_BOARD_WEBHOOK_PATH, (c) =>
    handleWebhookRequest(context, "reviewboard", c.req.raw)
  );

  app.get("*", (c) => {
    if (!context.enableWeb) {
      return c.notFound();
    }

    return c.html(context.webAppHtml, 200, {
      "Cache-Control": "no-store",
    });
  });

  app.notFound((c) => c.text("Not Found", 404));
  app.onError((error) => {
    logger.error("webhook", "Unhandled server error", error);
    return new Response("Internal Server Error", { status: 500 });
  });

  return app;
}

function createTlsOptions(sslCertPath: string, sslKeyPath: string, sslCaPath: string) {
  return {
    cert: Bun.file(sslCertPath),
    key: Bun.file(sslKeyPath),
    ...(sslCaPath
      ? {
          ca: [Bun.file(sslCaPath)],
        }
      : {}),
  };
}

function logServerStartup(context: ServerContext, port: number): void {
  logger.info("webhook", `Server listening on port ${port} (${context.protocol})`);
  console.log(`[WEBHOOK] Server listening on port ${port} (${context.protocol})`);
  console.log("[WEBHOOK] Endpoints:");
  if (context.enableWeb) {
    console.log(`[WEBHOOK]   GET  ${context.protocol}://localhost:${port}/`);
    console.log(
      `[WEBHOOK]   GET  ${context.protocol}://localhost:${port}${WEB_APP_DASHBOARD_ROUTE}`
    );
  }
  if (context.enableWebhook) {
    console.log(`[WEBHOOK]   POST ${context.protocol}://localhost:${port}${GITLAB_WEBHOOK_PATH}`);
    console.log(
      `[WEBHOOK]   POST ${context.protocol}://localhost:${port}${REVIEW_BOARD_WEBHOOK_PATH}`
    );
  }
  console.log(`[WEBHOOK]   GET  ${context.protocol}://localhost:${port}${STATUS_PATH}`);
}

export async function startServer(port = 3000, options?: ServerOptions): Promise<ServerHandle> {
  const runtime = await loadWorkflowRuntime();
  const enableWeb = options?.enableWeb ?? false;
  const enableWebhook = options?.enableWebhook ?? true;
  const repoPath = options?.repoPath ?? process.cwd();

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

  const sslCertPath = options?.sslCertPath || envOrConfig("SSL_CERT_PATH", runtime.sslCertPath, "");
  const sslKeyPath = options?.sslKeyPath || envOrConfig("SSL_KEY_PATH", runtime.sslKeyPath, "");
  const sslCaPath = options?.sslCaPath || envOrConfig("SSL_CA_PATH", runtime.sslCaPath, "");

  const context: ServerContext = {
    enableWeb,
    enableWebhook,
    protocol: "http",
    repoPath,
    runtime,
    webAppHtml: enableWeb ? getWebAppHtml() : "",
    webAppScript: enableWeb ? await readWebAppScript() : "",
    workQueue: new WorkQueue(runtime),
  };

  const app = createServerApp(context);

  let bunServer: Bun.Server<undefined>;

  if (sslCertPath && sslKeyPath) {
    try {
      bunServer = Bun.serve({
        port,
        fetch: app.fetch,
        tls: createTlsOptions(sslCertPath, sslKeyPath, sslCaPath),
      });
      context.protocol = "https";
    } catch (err) {
      logger.error("webhook", "Failed to load SSL certificates, falling back to HTTP", err);
      console.error(`[WEBHOOK] SSL Error: ${err instanceof Error ? err.message : String(err)}`);
      bunServer = Bun.serve({
        port,
        fetch: app.fetch,
      });
    }
  } else {
    bunServer = Bun.serve({
      port,
      fetch: app.fetch,
    });
  }

  const actualPort = bunServer.port ?? port;

  logServerStartup(context, actualPort);

  return {
    port: actualPort,
    protocol: context.protocol,
    url: bunServer.url,
    close: () => {
      bunServer.stop(true);
    },
    stop: (closeActiveConnections = true) => {
      bunServer.stop(closeActiveConnections);
    },
    get bunServer() {
      return bunServer;
    },
  };
}
