import { BrowserView, BrowserWindow } from "electrobun/bun"
import type { ApiRequestParams, ApiResponse, DesktopRPCSchema } from "../shared/rpc-types.js"
import {
  closeDb,
  loadAppState,
  loadWindowGeometry,
  savePreference,
  saveWindowGeometry,
} from "./app-state.js"
import { createApplicationMenu } from "./menus.js"

const APP_VERSION = "0.1.0"

/** Holds the Hono app's direct fetch handler — set after server starts. */
let serverFetch: ((request: Request) => Response | Promise<Response>) | null = null

async function startEmbeddedServer(): Promise<{ port: number; url: string; fetch: (req: Request) => Response | Promise<Response> }> {
  const { startServer } = await import("@cr/server")
  const handle = await startServer(0, {
    enableWeb: true,
    enableWebhook: false,
    desktop: true,
    repoPath: loadAppState().preferences.lastRepoPath ?? process.cwd(),
  })
  return { port: handle.port, url: handle.url.toString(), fetch: handle.fetch }
}

async function handleApiRequest(params: ApiRequestParams): Promise<ApiResponse> {
  if (!serverFetch) throw new Error("Server not initialized")
  const request = new Request(`http://localhost${params.path}`, {
    method: params.method,
    headers: { "Content-Type": "application/json" },
    body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
  })
  const response = await serverFetch(request)
  const body = await response.json().catch(() => null)
  return { status: response.status, body }
}

function createRpc() {
  return BrowserView.defineRPC<DesktopRPCSchema>({
    maxRequestTime: 30_000,
    handlers: {
      requests: {
        getAppState: () => loadAppState(),
        getAppVersion: () => APP_VERSION,
        saveWindowState: (geometry) => saveWindowGeometry(geometry),
        savePreference: ({ key, value }) => savePreference(key, value),
        apiRequest: (params) => handleApiRequest(params),
      },
      messages: {
        windowClosing: () => {},
      },
    },
  })
}

async function main() {
  const geometry = loadWindowGeometry()
  const rpc = createRpc()

  createApplicationMenu()

  const server = await startEmbeddedServer()
  serverFetch = server.fetch
  console.log(`[CR Desktop] Server started at ${server.url}`)

  const win = new BrowserWindow({
    title: "CR Review Command Center",
    url: server.url,
    titleBarStyle: "hiddenInset",
    frame: {
      width: geometry.width,
      height: geometry.height,
      x: geometry.x,
      y: geometry.y,
    },
    rpc,
  })

  // Persist window geometry on move/resize
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const debouncedSave = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const frame = win.getFrame()
      saveWindowGeometry(frame)
    }, 500)
  }

  win.on("resize", debouncedSave)
  win.on("move", debouncedSave)

  win.on("close", () => {
    const frame = win.getFrame()
    saveWindowGeometry(frame)
    closeDb()
  })
}

main().catch((err) => {
  console.error("[CR Desktop] Fatal error:", err)
  process.exit(1)
})
