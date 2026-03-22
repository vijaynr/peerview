import { BrowserView, BrowserWindow } from "electrobun/bun"
import type { DesktopRPCSchema } from "../shared/rpc-types.js"
import {
  closeDb,
  loadAppState,
  loadWindowGeometry,
  savePreference,
  saveWindowGeometry,
} from "./app-state.js"
import { createApplicationMenu } from "./menus.js"

const APP_VERSION = "0.1.0"

async function startEmbeddedServer(): Promise<{ port: number; url: string }> {
  const { startServer } = await import("@cr/server")
  const handle = await startServer(0, {
    enableWeb: true,
    enableWebhook: false,
    repoPath: loadAppState().preferences.lastRepoPath ?? process.cwd(),
  })
  return { port: handle.port, url: handle.url.toString() }
}

function createRpc() {
  return BrowserView.defineRPC<DesktopRPCSchema>({
    maxRequestTime: 5000,
    handlers: {
      requests: {
        getAppState: () => loadAppState(),
        getAppVersion: () => APP_VERSION,
        saveWindowState: (geometry) => saveWindowGeometry(geometry),
        savePreference: ({ key, value }) => savePreference(key, value),
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
  console.log(`[CR Desktop] Server started at ${server.url}`)

  const win = new BrowserWindow({
    title: "CR Review Command Center",
    url: server.url,
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
