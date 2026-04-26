// MUST be the first import — loads .env before any provider's top-level
// `process.env.X` read runs.
import './bootstrap.js'

import express from 'express'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
// Use bun:sqlite when running under Bun (production sidecar via
// `bun build --compile`); fall back to better-sqlite3 in plain Node so dev
// mode (npm run dev) still works without forcing a Bun install.
//
// API surface used: `db.exec()`, `db.prepare(sql).run/get/all(...)`.
// Both implementations match on those four names so callers don't change.
const isBun = typeof Bun !== 'undefined'
const Database = isBun
  ? (await import('bun:sqlite')).Database
  : (await import('better-sqlite3')).default
import { setupRoutes } from './router.js'
import { startScheduler } from './scheduler.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/stream' })

// Middleware
app.use(cors())
app.use(express.json())

// SQLite setup. KIMI_DB_PATH lets the Tauri shell point at the user's
// per-app data dir (e.g. ~/Library/Application Support/Kimi Radio/state.db
// on macOS); local dev defaults to the repo-relative file.
const db = new Database(process.env.KIMI_DB_PATH || join(__dirname, 'state.db'))
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS plays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER,
    track_title TEXT,
    track_artist TEXT,
    duration INTEGER,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS prefs (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`)

// WebSocket connections
const clients = new Set()
wss.on('connection', (ws) => {
  clients.add(ws)
  console.log('WS client connected')
  
  ws.on('close', () => {
    clients.delete(ws)
    console.log('WS client disconnected')
  })
})

export function broadcast(data) {
  const message = JSON.stringify(data)
  clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(message)
    }
  })
}

// Setup routes
setupRoutes(app, db, broadcast)

// Start scheduler
startScheduler(db, broadcast)

// Serve TTS cache files. Path mirrors what tts.js writes to (env var or
// repo-relative fallback) so the Tauri shell can override both at once.
app.use('/tts-cache', express.static(process.env.KIMI_CACHE_DIR || join(__dirname, 'tts-cache')))

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../web/dist')))
}

// Port: dev default 8080 (matches the Vite proxy + curl scripts); in the
// Tauri shell we set PORT=0 so the OS assigns a free port, then read
// the chosen port back via address() and print "KIMI_PORT=<n>" for the
// Rust side to grep stdout. The Tauri command then exposes it to the
// frontend via invoke('get_server_port').
const PORT_REQ = process.env.PORT !== undefined ? parseInt(process.env.PORT, 10) : 8080
server.listen(PORT_REQ, () => {
  const actual = server.address()?.port || PORT_REQ
  console.log(`Kimi Radio server running on http://localhost:${actual}`)
  console.log(`WebSocket on ws://localhost:${actual}/stream`)
  // Machine-readable line for the Tauri sidecar handler. Keep the exact
  // format `KIMI_PORT=<digits>\n` so the regex on the Rust side stays simple.
  console.log(`KIMI_PORT=${actual}`)
})
