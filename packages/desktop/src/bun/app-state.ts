import { Database } from "bun:sqlite"
import { existsSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import type { AppPreferences, AppState, WindowGeometry } from "../shared/rpc-types.js"

const PV_DIR = path.join(homedir(), ".pv")
const DB_PATH = path.join(PV_DIR, "desktop.db")

const DEFAULT_GEOMETRY: WindowGeometry = {
  x: 100,
  y: 100,
  width: 1400,
  height: 900,
}

let db: Database | null = null

function getDb(): Database {
  if (db) return db

  if (!existsSync(PV_DIR)) {
    mkdirSync(PV_DIR, { recursive: true })
  }

  db = new Database(DB_PATH, { create: true })
  db.exec("PRAGMA journal_mode=WAL;")

  db.exec(`
    CREATE TABLE IF NOT EXISTS window_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  return db
}

export function loadWindowGeometry(): WindowGeometry {
  try {
    const row = getDb()
      .query("SELECT x, y, width, height FROM window_state WHERE id = 1")
      .get() as WindowGeometry | null
    return row ?? DEFAULT_GEOMETRY
  } catch {
    return DEFAULT_GEOMETRY
  }
}

export function saveWindowGeometry(geometry: WindowGeometry): boolean {
  try {
    getDb()
      .query(
        `INSERT INTO window_state (id, x, y, width, height) VALUES (1, ?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET x = ?1, y = ?2, width = ?3, height = ?4`
      )
      .run(geometry.x, geometry.y, geometry.width, geometry.height)
    return true
  } catch {
    return false
  }
}

export function loadPreferences(): AppPreferences {
  try {
    const rows = getDb().query("SELECT key, value FROM preferences").all() as {
      key: string
      value: string
    }[]
    const prefs: AppPreferences = {}
    for (const row of rows) {
      if (row.key === "lastRepoPath") prefs.lastRepoPath = row.value
      if (row.key === "lastRemoteUrl") prefs.lastRemoteUrl = row.value
      if (row.key === "theme") prefs.theme = row.value as "dark" | "light"
    }
    return prefs
  } catch {
    return {}
  }
}

export function savePreference(key: string, value: string): boolean {
  try {
    getDb()
      .query(
        `INSERT INTO preferences (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = ?2`
      )
      .run(key, value)
    return true
  } catch {
    return false
  }
}

export function loadAppState(): AppState {
  return {
    windowGeometry: loadWindowGeometry(),
    preferences: loadPreferences(),
  }
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
