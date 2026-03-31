import { Hono } from "hono";
import { envOrConfig, loadDashboardData, loadWorkflowRuntime, logger } from "@pv/core";
import { createWebRoutes, WEB_APP_DASHBOARD_ROUTE, WEB_APP_ROOT_ROUTE } from "@pv/web";
import { createApiRoutes } from "./routes/api.js";
import { createStatusRoutes, STATUS_PATH } from "./routes/status.js";
import { createWebhookRoutes } from "./routes/webhooks.js";
import { WorkQueue } from "./workQueue.js";
import type { ServerContext } from "./types.js";

export type ServerOptions = {
  enableWeb?: boolean;
  enableWebhook?: boolean;
  desktop?: boolean;
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
  /** Direct access to the Hono app's fetch — bypasses HTTP for in-process callers. */
  fetch: (request: Request) => Response | Promise<Response>;
};

async function createServerApp(context: ServerContext): Promise<Hono> {
  const app = new Hono();

  app.use(async (c, next) => {
    console.log(`[SERVER] Incoming ${c.req.method} request to ${c.req.path}`);
    await next();
  });

  app.route("/", createStatusRoutes(context));
  app.route("/", createApiRoutes(context));

  if (context.enableWebhook) {
    app.route("/", createWebhookRoutes(context));
  }

  if (context.enableWeb) {
    const webRoutes = await createWebRoutes({
      loadDashboard: (args) =>
        loadDashboardData({
          repoPath: args?.repoPath ?? context.repoPath,
          remoteUrl: args?.remoteUrl,
        }),
      desktop: context.desktop,
    });
    app.route("/", webRoutes);
  }

  app.notFound((c) => c.text("Not Found", 404));
  app.onError((error) => {
    logger.error("server", "Unhandled server error", error);
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
  logger.info("server", `Server listening on port ${port} (${context.protocol})`);
  console.log(`[SERVER] Server listening on port ${port} (${context.protocol})`);
  console.log("[SERVER] Endpoints:");
  if (context.enableWeb) {
    console.log(`[SERVER]   GET  ${context.protocol}://localhost:${port}${WEB_APP_ROOT_ROUTE}`);
    console.log(`[SERVER]   GET  ${context.protocol}://localhost:${port}/web`);
    console.log(
      `[SERVER]   GET  ${context.protocol}://localhost:${port}${WEB_APP_DASHBOARD_ROUTE}`
    );
  }
  if (context.enableWebhook) {
    if (context.runtime.gitlabWebhookEnabled) {
      console.log(`[SERVER]   POST ${context.protocol}://localhost:${port}/webhook/gitlab`);
    }
    if (context.runtime.githubWebhookEnabled) {
      console.log(`[SERVER]   POST ${context.protocol}://localhost:${port}/webhook/github`);
    }
    if (context.runtime.reviewboardWebhookEnabled) {
      console.log(`[SERVER]   POST ${context.protocol}://localhost:${port}/webhook/reviewboard`);
    }
  }
  console.log(`[SERVER]   GET  ${context.protocol}://localhost:${port}${STATUS_PATH}`);
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
  runtime.githubWebhookSecret = envOrConfig(
    "GITHUB_WEBHOOK_SECRET",
    runtime.githubWebhookSecret,
    ""
  );
  runtime.rbWebhookSecret = envOrConfig("RB_WEBHOOK_SECRET", runtime.rbWebhookSecret, "");

  const sslCertPath = options?.sslCertPath || envOrConfig("SSL_CERT_PATH", runtime.sslCertPath, "");
  const sslKeyPath = options?.sslKeyPath || envOrConfig("SSL_KEY_PATH", runtime.sslKeyPath, "");
  const sslCaPath = options?.sslCaPath || envOrConfig("SSL_CA_PATH", runtime.sslCaPath, "");

  const context: ServerContext = {
    enableWeb,
    enableWebhook,
    desktop: options?.desktop ?? false,
    protocol: "http",
    repoPath,
    runtime,
    workQueue: new WorkQueue(runtime),
  };

  const app = await createServerApp(context);

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
      logger.error("server", "Failed to load SSL certificates, falling back to HTTP", err);
      console.error(`[SERVER] SSL Error: ${err instanceof Error ? err.message : String(err)}`);
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
    fetch: app.fetch.bind(app),
  };
}
