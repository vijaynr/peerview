import type { RPCSchema } from "electrobun/bun"

export type WindowGeometry = {
  x: number
  y: number
  width: number
  height: number
}

export type AppPreferences = {
  lastRepoPath?: string
  lastRemoteUrl?: string
  theme?: "dark" | "light"
}

export type AppState = {
  windowGeometry: WindowGeometry | null
  preferences: AppPreferences
}

export type DesktopRPCSchema = {
  bun: RPCSchema<{
    requests: {
      getAppState: {
        params: Record<string, never>
        response: AppState
      }
      getAppVersion: {
        params: Record<string, never>
        response: string
      }
      saveWindowState: {
        params: WindowGeometry
        response: boolean
      }
      savePreference: {
        params: { key: string; value: string }
        response: boolean
      }
    }
    messages: {
      windowClosing: Record<string, never>
    }
  }>
  webview: RPCSchema<{
    requests: {
      ping: {
        params: Record<string, never>
        response: string
      }
    }
    messages: {
      serverReady: {
        url: string
        port: number
      }
    }
  }>
}
