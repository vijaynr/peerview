import { Hono, type Context } from "hono";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crFaviconSvg from "./assets/cr-favicon.svg" with { type: "text" };
import crAppIconSvg from "./assets/cr-app-icon.svg" with { type: "text" };
import { WEB_APP_FAVICON_ROUTE, WEB_APP_ICON_ROUTE } from "./asset-routes.js";
import {
  getBootLoaderHtml,
  getBootLoaderScript,
  getBootLoaderStyles,
} from "./boot-loader.js";

export const WEB_APP_ROOT_ROUTE = "/";
export const WEB_APP_ALT_ROUTE = "/web";
export const WEB_APP_SCRIPT_ROUTE = "/web/app.js";
export const WEB_APP_DASHBOARD_ROUTE = "/api/dashboard";

export type WebRoutesOptions = {
  loadDashboard: (args?: { repoPath?: string; remoteUrl?: string }) => Promise<unknown>;
  desktop?: boolean;
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
  // $bunfs: bun --compile embeds files in a virtual filesystem
  // Electrobun also bundles all imports into a single JS file — the
  // generated web-app assets are inlined and resolvable, so we treat
  // it as a bundled runtime too. Detect that by checking whether our
  // source path no longer points at the original packages/web/src dir.
  if (import.meta.url.includes("$bunfs")) return true;
  try {
    return !import.meta.url.includes("/packages/web/");
  } catch {
    return false;
  }
}

export function getWebAppHtml(styles: string, options?: { desktop?: boolean }): string {
  const desktopAttr = options?.desktop ? ' data-desktop="true"' : "";
  const desktopPlatformAttr = options?.desktop
    ? ` data-desktop-platform="${process.platform}"`
    : "";
  return `<!doctype html>
<html lang="en" data-theme="cr-black"${desktopAttr}${desktopPlatformAttr}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PeerView</title>
    <meta name="color-scheme" content="dark light" />
    <meta name="theme-color" content="#000000" />
    <link rel="icon" type="image/svg+xml" href="${WEB_APP_FAVICON_ROUTE}" />
    <script>
(() => {
  try {
    const storedTheme = window.localStorage.getItem("pv:web-theme");
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
cr-stat-card, cr-review-list, cr-request-item, cr-provider-card, cr-config-card, cr-diff-viewer, cr-dashboard-header, cr-overview-page, cr-provider-page, cr-settings-page, cr-theme-toggle, cr-queue-rail, cr-workspace-panel, cr-analysis-rail, cr-review-panel, cr-summary-panel, cr-chat-panel, cr-comments-workspace, cr-inline-comment-popover, cr-commits-list, cr-discussion-thread, cr-config-input, cr-provider-summary-card, cr-provider-icon, cr-toast-notification { display: contents; }
cr-sidebar-nav { display: flex; flex-direction: column; min-height: 100vh; width: min(18.5rem, calc(100vw - 1rem)); }
@media (min-width: 1024px) {
  cr-sidebar-nav {
    transition: width 220ms ease;
    width: var(--cr-sidebar-shell-width, 16rem);
  }
}
${getBootLoaderStyles()}
    </style>
  </head>
  <body>
    ${getBootLoaderHtml()}
    <cr-dashboard-app></cr-dashboard-app>
    <script type="module" src="${WEB_APP_SCRIPT_ROUTE}"></script>
    ${getBootLoaderScript()}
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
    throw new Error("PeerView web bundling requires Bun runtime.");
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

  app.get(WEB_APP_ICON_ROUTE, (c) =>
    c.body(crAppIconSvg, 200, {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
    })
  );

  app.get(WEB_APP_FAVICON_ROUTE, (c) =>
    c.body(crFaviconSvg, 200, {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
    })
  );

  const renderHtml = async (c: Context) => {
    const styles = await readWebAppStyles();
    return c.html(getWebAppHtml(styles, { desktop: options.desktop }), 200, {
      "Cache-Control": "no-store",
    });
  };

  app.get(WEB_APP_ROOT_ROUTE, renderHtml);
  app.get(WEB_APP_ALT_ROUTE, renderHtml);

  return app;
}
