import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export function buildContext(db, extra = {}) {
  // 1. System prompt
  const personaPath = join(__dirname, 'prompts', 'dj-persona.md')
  let systemPrompt = existsSync(personaPath) 
    ? readFileSync(personaPath, 'utf-8')
    : 'You are a knowledgeable music DJ assistant.'

  // 2. User taste
  const tastePath = join(__dirname, 'data', 'taste.md')
  const taste = existsSync(tastePath) ? readFileSync(tastePath, 'utf-8') : ''

  const routinesPath = join(__dirname, 'data', 'routines.md')
  const routines = existsSync(routinesPath) ? readFileSync(routinesPath, 'utf-8') : ''

  // 3. Environment — human-readable local time. Previously sent
  // toISOString() which is UTC; with the server in UTC this made the LLM
  // think noon-Tokyo was "4 AM" because it parsed the Z timestamp instead
  // of trusting the `hour` integer.
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]
  const timeOfDay =
    hour < 5  ? 'late night' :
    hour < 9  ? 'early morning' :
    hour < 12 ? 'morning' :
    hour < 14 ? 'midday' :
    hour < 17 ? 'afternoon' :
    hour < 20 ? 'early evening' :
    hour < 23 ? 'late evening' :
                'late night'
  const env = {
    time: `${dayName} ${timeOfDay} — ${hour}:${String(minute).padStart(2, '0')}`,
    hour,
    timeOfDay,
    dayName,
    weather: extra.weather || 'unknown',
    calendar: extra.calendar || []
  }

  // 4. Memory
  const recentPlays = db.prepare('SELECT * FROM plays ORDER BY played_at DESC LIMIT 5').all()
  const recentMessages = db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 5').all()

  // 5. User input / tool results
  // (passed separately)

  // 6. Execution trajectory
  const lastActions = db.prepare('SELECT * FROM plays ORDER BY played_at DESC LIMIT 3').all()

  return {
    systemPrompt,
    taste,
    routines,
    environment: env,
    memory: { recentPlays, recentMessages },
    trajectory: lastActions
  }
}
