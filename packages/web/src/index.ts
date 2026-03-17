import { Hono, type Context } from "hono";
import { fileURLToPath } from "node:url";

export const WEB_APP_ROOT_ROUTE = "/";
export const WEB_APP_ALT_ROUTE = "/web";
export const WEB_APP_SCRIPT_ROUTE = "/web/app.js";
export const WEB_APP_DASHBOARD_ROUTE = "/api/dashboard";

export type WebRoutesOptions = {
  loadDashboard: () => Promise<unknown>;
};

const appEntryUrl = new URL("./app.ts", import.meta.url);
let webAppScriptPromise: Promise<string> | null = null;

function isBundledRuntime(): boolean {
  return import.meta.url.includes("$bunfs");
}

export function getWebAppHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CR Review Command Center</title>
    <meta name="color-scheme" content="light" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Serif:wght@400;600&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        color: #201a16;
        background: #f4ede2;
        font-family: "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(217, 118, 18, 0.1), transparent 28rem),
          radial-gradient(circle at top right, rgba(44, 106, 83, 0.08), transparent 26rem),
          linear-gradient(180deg, #f7f1e7 0%, #efe5d5 100%);
      }
    </style>
  </head>
  <body>
    <cr-dashboard-app></cr-dashboard-app>
    <script type="module" src="${WEB_APP_SCRIPT_ROUTE}"></script>
  </body>
</html>`;
}

export async function readWebAppScript(): Promise<string> {
  if (!webAppScriptPromise) {
    webAppScriptPromise = bundleWebAppScript();
  }

  return webAppScriptPromise;
}

async function bundleWebAppScript(): Promise<string> {
  if (typeof Bun === "undefined") {
    throw new Error("CR web bundling requires Bun runtime.");
  }

  if (isBundledRuntime()) {
    const bundledModule = await import("./generated/app-bundle.generated.js");
    return bundledModule.default;
  }

  const result = await Bun.build({
    entrypoints: [fileURLToPath(appEntryUrl)],
    target: "browser",
    format: "esm",
    minify: false,
    splitting: false,
  });

  if (!result.success) {
    const buildLog = result.logs.map((log: { message: string }) => log.message).join("\n");
    throw new Error(`Failed to bundle CR web app.\n${buildLog}`);
  }

  const output = result.outputs[0];
  if (!output) {
    throw new Error("Failed to bundle CR web app: no output generated.");
  }

  return output.text();
}

export async function createWebRoutes(options: WebRoutesOptions): Promise<Hono> {
  const app = new Hono();
  const webAppHtml = getWebAppHtml();
  const webAppScript = await readWebAppScript();

  app.get(WEB_APP_DASHBOARD_ROUTE, async () => {
    try {
      const dashboard = await options.loadDashboard();
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
  });

  app.get(WEB_APP_SCRIPT_ROUTE, () => {
    return new Response(webAppScript, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  });

  const renderHtml = (c: Context) =>
    c.html(webAppHtml, 200, {
      "Cache-Control": "no-store",
    });

  app.get(WEB_APP_ROOT_ROUTE, renderHtml);
  app.get(WEB_APP_ALT_ROUTE, renderHtml);

  return app;
}
