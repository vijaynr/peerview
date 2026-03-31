import { Hono } from "hono";
import { WEB_APP_DASHBOARD_ROUTE, WEB_APP_ROOT_ROUTE } from "@pv/web";
import type { ServerContext } from "../types.js";

export const STATUS_PATH = "/status";

export function createStatusRoutes(context: ServerContext): Hono {
  const app = new Hono();

  app.get(STATUS_PATH, (c) =>
    c.json({
      ...context.workQueue.getStatus(),
      routes: {
        ...(context.enableWebhook
          ? {
              ...(context.runtime.gitlabWebhookEnabled
                ? { gitlab: "/webhook/gitlab" }
                : {}),
              ...(context.runtime.githubWebhookEnabled
                ? { github: "/webhook/github" }
                : {}),
              ...(context.runtime.reviewboardWebhookEnabled
                ? { reviewboard: "/webhook/reviewboard" }
                : {}),
            }
          : {}),
        ...(context.enableWeb
          ? {
              web: WEB_APP_ROOT_ROUTE,
              dashboard: WEB_APP_DASHBOARD_ROUTE,
            }
          : {}),
      },
    })
  );

  return app;
}
