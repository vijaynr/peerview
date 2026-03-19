import { Hono, type Context } from "hono";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const WEB_APP_ROOT_ROUTE = "/";
export const WEB_APP_ALT_ROUTE = "/web";
export const WEB_APP_SCRIPT_ROUTE = "/web/app.js";
export const WEB_APP_DASHBOARD_ROUTE = "/api/dashboard";

export type WebRoutesOptions = {
  loadDashboard: (args?: { repoPath?: string; remoteUrl?: string }) => Promise<unknown>;
};

type WebAppAssets = {
  script: string;
  styles: string;
};

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const webPackageDir = path.resolve(srcDir, "..");
const viteConfigFile = path.join(webPackageDir, "vite.config.ts");
const builtScriptFile = path.join(webPackageDir, "build", "app.js");
const builtStylesFile = path.join(webPackageDir, "build", "app.css");
const DEV_ASSET_CACHE_MS = 250;

let bundledAssetsPromise: Promise<WebAppAssets> | null = null;
let devAssetsPromise: Promise<WebAppAssets> | null = null;
let devAssetsBuiltAt = 0;

function isBundledRuntime(): boolean {
  return import.meta.url.includes("$bunfs");
}

export function getWebAppHtml(styles: string): string {
  return `<!doctype html>
<html lang="en" data-theme="cr-black">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CR Review Command Center</title>
    <meta name="color-scheme" content="dark light" />
    <meta name="theme-color" content="#000000" />
    <script>
(() => {
  try {
    const storedTheme = window.localStorage.getItem("cr:web-theme");
    if (storedTheme === "light") {
      document.documentElement.setAttribute("data-theme", "cr-light");
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#f3f7fc");
    }
  } catch {}
})();
    </script>
    <style>
${styles}
body { margin: 0; }
cr-dashboard-app { display: block; min-height: 100vh; }
cr-stat-card, cr-review-list, cr-request-item, cr-provider-card, cr-config-card, cr-diff-viewer, cr-dashboard-header { display: contents; }
    </style>
  </head>
  <body>
    <cr-dashboard-app></cr-dashboard-app>
    <script type="module" src="${WEB_APP_SCRIPT_ROUTE}"></script>
  </body>
</html>`;
}

async function readGeneratedWebAppAssets(): Promise<WebAppAssets> {
  const [scriptModule, stylesModule] = await Promise.all([
    import("./generated/app-bundle.generated.js"),
    import("./generated/app-styles.generated.js"),
  ]);

  return {
    script: scriptModule.default,
    styles: stylesModule.default,
  };
}

async function buildWebAppAssets(): Promise<WebAppAssets> {
  if (typeof Bun === "undefined") {
    throw new Error("CR web bundling requires Bun runtime.");
  }

  const { build } = await import("vite");
  await build({
    configFile: viteConfigFile,
    logLevel: "error",
  });

  const scriptFile = Bun.file(builtScriptFile);
  const stylesFile = Bun.file(builtStylesFile);

  if (!(await scriptFile.exists())) {
    throw new Error(`Expected Vite output at ${builtScriptFile}.`);
  }

  if (!(await stylesFile.exists())) {
    throw new Error(`Expected Vite output at ${builtStylesFile}.`);
  }

  return {
    script: await scriptFile.text(),
    styles: await stylesFile.text(),
  };
}

async function readWebAppAssets(): Promise<WebAppAssets> {
  if (isBundledRuntime()) {
    if (!bundledAssetsPromise) {
      bundledAssetsPromise = readGeneratedWebAppAssets();
    }

    return bundledAssetsPromise;
  }

  const now = Date.now();
  if (!devAssetsPromise || now - devAssetsBuiltAt > DEV_ASSET_CACHE_MS) {
    devAssetsBuiltAt = now;
    devAssetsPromise = buildWebAppAssets().catch((error) => {
      devAssetsPromise = null;
      throw error;
    });
  }

  return devAssetsPromise;
}

export async function readWebAppScript(): Promise<string> {
  return (await readWebAppAssets()).script;
}

export async function readWebAppStyles(): Promise<string> {
  return (await readWebAppAssets()).styles;
}

export async function createWebRoutes(options: WebRoutesOptions): Promise<Hono> {
  const app = new Hono();

  app.get(WEB_APP_DASHBOARD_ROUTE, async (c) => {
    try {
      const url = new URL(c.req.url);
      const dashboard = await options.loadDashboard({
        repoPath: url.searchParams.get("repoPath") ?? undefined,
        remoteUrl: url.searchParams.get("remoteUrl") ?? undefined,
      });
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

  app.get(WEB_APP_SCRIPT_ROUTE, async (c) => {
    const script = await readWebAppScript();
    return c.body(script, 200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    });
  });

  const renderHtml = async (c: Context) => {
    const styles = await readWebAppStyles();
    return c.html(getWebAppHtml(styles), 200, {
      "Cache-Control": "no-store",
    });
  };

  app.get(WEB_APP_ROOT_ROUTE, renderHtml);
  app.get(WEB_APP_ALT_ROUTE, renderHtml);

  return app;
}
