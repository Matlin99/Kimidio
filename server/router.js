import { chat, chatWithFallback, getProviderStatus } from './llm/index.js'
import { buildContext } from './context.js'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { synthesizeSpeech, streamSpeechTo } from './tts.js'
import { getEventsToday, getAbstractToday } from './calendar.js'
import * as music from './music/adapters/index.js'
import express from 'express'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// SoundCloud is flooded with AI voice covers, karaoke tracks, and
// "piano version" / "instrumental" variants. This heuristic rejects hits
// whose title or artist name looks like one of those so we get closer to
// the original artist's recording.
function looksLikeCover(track) {
  if (!track) return true
  const title = (track.title || '').toLowerCase()
  const artist = (track.artist || '').toLowerCase()
  const combo = `${title} ${artist}`

  // Snippet / preview filter — labels upload 30s teasers of full songs
  // for promotion; SC search returns these alongside real tracks. Cap at
  // 60s as the floor for "real song" (interludes / intros are typically
  // labelled as such and the LLM picks won't request <60s tracks).
  // Also catch explicit snippet markers in the title.
  if (track.duration && track.duration < 60) return true
  if (/\b(snippet|preview|teaser|clip|demo|sample)\b/i.test(title)) return true

  // Hour-long loop bait — anything > 15min when target is a normal pop song.
  if (track.duration && track.duration > 900) return true

  const coverMarkers = [
    'cover', 'karaoke', 'instrumental', 'piano version', '钢琴版',
    '翻唱', '伴奏', '纯音乐', '钢琴', 'piano', 'ai cover', 'ai版',
    'acoustic version', 'remake', 'tribute', '女声版', '男声版',
    'remix', '伴唱', '翻奏', 'lofi version', 'slowed', 'sped up'
  ]
  for (const m of coverMarkers) {
    if (combo.includes(m)) return true
  }
  // AI-cover / impersonator channel name patterns — single glyph + 小爱 / 小美 etc.
  if (/小爱|小美|Lucky小|Xai|ai cover/i.test(artist)) return true
  return false
}

export function setupRoutes(app, db, broadcast) {
  // Serve local music files
  app.use('/music/local', express.static(join(__dirname, 'music', 'local')))
  // GET /api/now - current playing status
  app.get('/api/now', (req, res) => {
    const lastPlay = db.prepare('SELECT * FROM plays ORDER BY played_at DESC LIMIT 1').get()
    res.json({
      nowPlaying: lastPlay || null,
      timestamp: new Date().toISOString()
    })
  })

  // GET /api/search - search music
  app.get('/api/search', async (req, res) => {
    const { q, source = 'sc', limit = 10 } = req.query
    if (!q) return res.status(400).json({ error: 'Query required' })
    try {
      const results = await music.search(q, source, Number(limit))
      res.json({ results })
    } catch (e) {
      console.error('Search error:', e)
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/song/url - get playable URL
  // title/artist are optional but enable SC fallback for geo-blocked sources
  app.get('/api/song/url', async (req, res) => {
    const { id, source = 'sc', title = '', artist = '' } = req.query
    if (!id) return res.status(400).json({ error: 'ID required' })
    console.log(`[song/url] source=${source} id=${id} title="${title}" artist="${artist}"`)
    try {
      const url = await music.getUrl({ source, sourceId: id, title, artist })
      res.json({ url })
    } catch (e) {
      console.error('Song URL error:', e)
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/playlist/init - initialize recommendation playlist
  app.post('/api/playlist/init', async (req, res) => {
    const { keyword = 'Nujabes', source = 'sc', limit = 10 } = req.body
    try {
      const playlist = await music.initPlaylist(keyword, source, Number(limit))
      res.json({ playlist })
    } catch (e) {
      console.error('Playlist init error:', e)
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/playlist/curate - AI DJ picks the opening queue based on context
  // Falls back to a random seed keyword if LLM fails or returns unresolvable picks.
  app.post('/api/playlist/curate', async (req, res) => {
    const { count = 10, provider: requestedProvider, hint = '', taste: clientTaste, blockHint, calendarUrls } = req.body || {}

    // Format client-supplied taste (from WelcomeOverlay) into a prompt block.
    // Empty arrays / empty strings are dropped so the LLM doesn't get "Genres: ."
    const formatClientTaste = (t) => {
      if (!t || typeof t !== 'object') return ''
      const parts = []
      if (Array.isArray(t.genres) && t.genres.length) parts.push(`Genres they enjoy: ${t.genres.join(', ')}`)
      if (Array.isArray(t.vibes) && t.vibes.length) parts.push(`Desired vibe: ${t.vibes.join(', ')}`)
      if (typeof t.artists === 'string' && t.artists.trim()) parts.push(`Favorite artists: ${t.artists.trim()}`)
      return parts.join('\n')
    }
    const declaredTaste = formatClientTaste(clientTaste)

    // Keyword pool for fallback — diverse but coherent with the chill/jazz-hop vibe.
    // Nujabes is intentionally excluded: the hardcoded legacy seed was Nujabes,
    // and keeping it here makes "curate worked" vs "stale JS" indistinguishable.
    const POOL = [
      'J Dilla', 'Tycho', 'Bonobo', 'FKJ',
      'Tomppabeats', 'Ryo Fukui', 'Masayoshi Takanaka',
      'Madlib', 'Emancipator', 'Haruomi Hosono', 'City Pop',
      'lofi hip hop', 'DJ Okawari', 'Uyama Hiroto'
    ]

    async function resolveByLLM() {
      const ctx = buildContext(db, { weather: req.body?.weather })

      // Schedule panel: user is browsing future / past blocks. Override the
      // wall-clock fields so the LLM curates for the chosen block, not "now".
      // We keep the rest of the context (taste, weather, recent plays) intact.
      if (blockHint && typeof blockHint === 'object') {
        if (Number.isFinite(blockHint.hour)) ctx.environment.hour = blockHint.hour
        if (blockHint.label) {
          ctx.environment.time = `${ctx.environment.dayName} ${blockHint.label.toLowerCase()} — ${blockHint.hour ?? '?'}:00`
          ctx.environment.timeOfDay = blockHint.timeOfDay || blockHint.label
        }
      }

      // Hard mood constraint per block. Without this, the LLM picks
      // tonally-mismatched tracks (e.g. heavy hip-hop at 7am, high-BPM
      // electronic at midnight). Kept inline rather than in context.js
      // because curate is the only consumer right now.
      const blockMoodForHour = (h) => {
        if (h < 5)  return { label: 'Late night',    vibe: 'hushed and minimal — soft piano, deep ambient, slow downtempo. AVOID anything loud, aggressive, or above ~95 BPM.' }
        if (h < 9)  return { label: 'Early morning', vibe: 'gentle wake — acoustic, warm tones, slow tempo, light electronic. AVOID heavy beats, harsh vocals, or anything that demands attention.' }
        if (h < 12) return { label: 'Morning focus', vibe: 'instrumental momentum — lofi hip-hop, post-rock, mellow jazz, ambient electronic. AVOID lyric-heavy tracks that distract from work.' }
        if (h < 14) return { label: 'Lunch',         vibe: 'easy reset — soft electronic, breezy bossa, mellow soul, light indie. Social-friendly, not too loud.' }
        if (h < 17) return { label: 'Afternoon',     vibe: 'steady rhythm — chill house, jazz hop, indie pop, neo-soul. Energy stays even, neither sleepy nor hype.' }
        if (h < 20) return { label: 'Wind down',     vibe: 'soft transition — ambient electronic, soulful R&B, acoustic. AVOID anything that ramps energy back up.' }
        if (h < 23) return { label: 'Evening',       vibe: 'tonight feel — atmospheric, neo-soul, downtempo, deep cuts. Slightly more sonic depth than afternoon.' }
        return         { label: 'Late night',    vibe: 'hushed and minimal — soft piano, deep ambient, slow downtempo. AVOID anything loud, aggressive, or above ~95 BPM.' }
      }
      const blockGuide = blockMoodForHour(ctx.environment.hour)

      // Calendar awareness — fetch the privacy-stripped per-block summary
      // (counts + busy minutes only, NO titles ever sent to the LLM).
      // If the user has no calendar URLs configured OR there are no events
      // today, we skip this section entirely so the prompt stays clean.
      let calendarLine = ''
      try {
        if (Array.isArray(calendarUrls) && calendarUrls.filter(Boolean).length > 0) {
          const summary = await getAbstractToday(calendarUrls)
          const blockIds = Object.keys(summary)
          if (blockIds.length > 0) {
            // Build a compact per-block readout the LLM can scan quickly.
            // e.g. "morning: 1 meeting (60 min), afternoon: 2 meetings (90 min)"
            const parts = blockIds.map(bid => {
              const { count, busyMinutes } = summary[bid]
              return `${bid}: ${count} ${count === 1 ? 'event' : 'events'} (~${busyMinutes} min)`
            })
            calendarLine = `\n- Today's calendar (per block, busy minutes only — no titles): ${parts.join('; ')}`
          }
        }
      } catch (e) {
        console.warn('[curate] calendar context skipped:', e.message)
      }

      // Build provider try-order: requested first, then every other configured
      // real provider, so e.g. Kimi 429 → falls over to MiniMax before giving
      // up the AI path.
      const configuredProviders = getProviderStatus()
        .filter(p => p.configured && !p.isMock)
        .map(p => p.name)
      const tryOrder = []
      if (requestedProvider && configuredProviders.includes(requestedProvider)) {
        tryOrder.push(requestedProvider)
      }
      for (const p of configuredProviders) {
        if (!tryOrder.includes(p)) tryOrder.push(p)
      }
      if (tryOrder.length === 0) tryOrder.push('mock')

      // Ask for extra picks so cover-filtering + SC resolution drops still
      // leave enough tracks. 1.6x gives good headroom.
      const askCount = Math.ceil(count * 1.6)
      const sys = `You are an AI music DJ curating the opening queue for a user's radio session.

LANGUAGE: every text field you produce ("say", any commentary) MUST be in English. Do not echo the user's input language.

Pick ${askCount} tracks (we'll keep the best ${count}) that fit the current moment. Consider:
- Time of day (hour ${ctx.environment.hour}, ${ctx.environment.time})
- Time-block mood (HARD CONSTRAINT — picks must fit this vibe):
  **${blockGuide.label}** — ${blockGuide.vibe}
- Weather: ${ctx.environment.weather}${calendarLine}${calendarLine ? `
  (When a block is busy with meetings, lean toward instrumental / lyric-light tracks
  so the music can sit underneath conversation. Free blocks can carry more vocal /
  attention-grabbing picks. If no calendar info appears, ignore this rule.)` : ''}
${declaredTaste ? `- User-declared preferences (STRONG signal, weight picks toward these):\n${declaredTaste}\n` : ''}- User taste profile:
${ctx.taste || '(no taste profile)'}
- Daily routines:
${ctx.routines || '(none)'}
- Recent plays to AVOID repeating:
${ctx.memory.recentPlays.map(p => `- ${p.track_title} — ${p.track_artist}`).join('\n') || '(none)'}
${hint ? `\nUser hint: ${hint}` : ''}

${declaredTaste
  ? 'Stay close to the declared genres/vibes. 1-2 adjacent discoveries are fine, but the set should feel on-brand to the user\'s selection.'
  : 'Prefer tracks that actually exist on streaming services. Diversity matters — don\'t pick 10 tracks from the same artist.'}

Respond ONLY with valid JSON in this exact shape (no prose, no markdown fence).
Both "say" and "picks" are REQUIRED — do not omit "say".
{
  "say": "<REQUIRED: one short sentence of DJ intro, 10-25 words, spoken-style>",
  "picks": [
    {"title": "<exact track title>", "artist": "<artist name>"},
    ...
  ]
}`

      const llmMessages = [
        { role: 'system', content: sys },
        { role: 'user', content: 'Curate the opening queue now.' }
      ]
      let response = null
      let lastErr = null
      for (const providerName of tryOrder) {
        try {
          response = await chat(providerName, llmMessages, { temperature: 0.8, maxTokens: 1200 })
          console.log(`[curate] provider=${providerName} ok`)
          break
        } catch (e) {
          lastErr = e
          const status = e.response?.status || ''
          console.warn(`[curate] provider=${providerName} failed ${status}: ${e.message}`)
        }
      }
      if (!response) {
        if (lastErr) throw lastErr
        return null
      }

      let parsed = response.structured
      if (!parsed) {
        const m = response.content.match(/\{[\s\S]*\}/)
        if (m) {
          try { parsed = JSON.parse(m[0]) } catch { parsed = null }
        }
      }
      if (!parsed?.picks?.length) return null

      // Resolve picks in parallel against SoundCloud first (direct progressive
      // streams, no cipher). Misses fall through to YT search + yt-dlp at
      // playback time, covering Mandopop / J-pop / cold-catalog tracks.
      // Filter: reject hits whose title+artist share no significant tokens
      // with the LLM pick — SC returns a "best effort" first result even for
      // totally unrelated queries (e.g. an Arabic Quran recitation for an
      // obscure jazz track). Word overlap catches those.
      const normalize = (s) =>
        (s || '').toLowerCase()
          .replace(/[^\w\s一-鿿]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length >= 2)
      const hitMatchesPick = (pick, hit) => {
        const pickTokens = new Set([...normalize(pick.title), ...normalize(pick.artist)])
        if (pickTokens.size === 0) return true
        const hitText = normalize(`${hit.title} ${hit.artist}`).join(' ')
        for (const w of pickTokens) {
          if (hitText.includes(w)) return true
        }
        return false
      }

      // Resolve up to 1.6x the requested count so we can drop covers /
      // bad hits and still likely land on `count` usable tracks.
      const resolved = await Promise.all(
        parsed.picks.slice(0, Math.ceil(count * 1.6)).map(async (p) => {
          const q = [p.title, p.artist].filter(Boolean).join(' ').trim()
          if (!q) return null
          try {
            const hits = await music.search(q, 'sc', 6)
            // Prefer non-cover hits that also match the pick semantically
            for (const h of hits) {
              if (hitMatchesPick(p, h) && !looksLikeCover(h)) return h
            }
            // Fallback: accept any non-cover match
            for (const h of hits) {
              if (!looksLikeCover(h)) return h
            }
            return null
          } catch {
            return null
          }
        })
      )
      const queue = []
      const seen = new Set()
      for (const t of resolved) {
        if (!t || seen.has(t.id)) continue
        seen.add(t.id)
        queue.push(t)
      }
      if (queue.length < 3) return null

      // Guarantee a non-empty DJ intro so the frontend always has something
      // to speak — some models drop the `say` field even when asked.
      const saySource = (parsed.say || '').trim()
      const fallbackSay = queue[0]
        ? `Tonight we're opening with ${queue[0].title} by ${queue[0].artist}.`
        : `Tonight's set is ready.`
      const say = saySource || fallbackSay
      if (!saySource) {
        console.warn('[curate] LLM returned empty `say`; using auto-generated intro')
      }
      return { say, queue }
    }

    async function resolveByPool() {
      const keyword = POOL[Math.floor(Math.random() * POOL.length)]
      // Use SoundCloud: plays reliably everywhere, no geo-blocking
      const queue = await music.search(keyword, 'sc', count)
      return {
        say: `Tonight's set — anchored around ${keyword}.`,
        queue,
        seed: keyword
      }
    }

    try {
      console.log(`[curate] called count=${count} provider=${requestedProvider || 'auto'}`)
      const ai = await resolveByLLM().catch(e => {
        console.warn('[curate] LLM path failed:', e.message)
        return null
      })
      if (ai?.queue?.length) {
        console.log(`[curate] source=ai returned ${ai.queue.length} tracks`)
        return res.json({ say: ai.say, queue: ai.queue, source: 'ai' })
      }
      const fb = await resolveByPool()
      if (fb.queue.length) {
        console.log(`[curate] source=pool seed="${fb.seed}" returned ${fb.queue.length} tracks`)
        return res.json({ say: fb.say, queue: fb.queue, source: 'pool', seed: fb.seed })
      }
      res.status(500).json({ error: 'No tracks could be resolved from any source' })
    } catch (e) {
      console.error('[curate] fatal:', e)
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/next - next track suggestion
  app.get('/api/next', async (req, res) => {
    res.json({ suggestions: [] })
  })

  // GET /api/taste - user taste profile
  app.get('/api/taste', (req, res) => {
    try {
      const dataDir = join(__dirname, 'data')
      if (!existsSync(dataDir)) {
        return res.json({ error: 'No taste data found' })
      }
      const files = readdirSync(dataDir)
      const taste = {}
      files.forEach(file => {
        const content = readFileSync(join(dataDir, file), 'utf-8')
        taste[file] = content
      })
      res.json(taste)
    } catch (e) {
      res.json({ error: 'No taste data found' })
    }
  })

  // GET /api/plan/today - today's schedule
  app.get('/api/plan/today', (req, res) => {
    const today = new Date()
    res.json({
      date: today.toISOString().split('T')[0],
      schedule: [
        { time: '07:00', event: 'Morning Chill' },
        { time: '09:00', event: 'Work Focus' },
        { time: '12:00', event: 'Lunch Break' },
        { time: '18:00', event: 'Evening Wind Down' },
      ]
    })
  })

  // GET /api/providers - available LLM providers
  app.get('/api/providers', (req, res) => {
    res.json({ providers: getProviderStatus() })
  })

  // POST /api/chat - AI chat
  app.post('/api/chat', async (req, res) => {
    const { message, history = [], provider: requestedProvider } = req.body

    try {
      // Save user message
      db.prepare('INSERT INTO messages (role, content) VALUES (?, ?)').run('user', message)

      // Build rich context using the 6-piece assembler
      const ctx = buildContext(db, {
        weather: req.body.weather,
        calendar: req.body.calendar
      })

      // Assemble messages for LLM
      const systemContent = `${ctx.systemPrompt}

LANGUAGE: respond in English only, regardless of the user's input language.
Even if the user writes in Chinese / Japanese / any other script, the
"say" field, all prose, and any commentary MUST be English. No exceptions.

## User Taste Profile
${ctx.taste}

## Daily Routines
${ctx.routines}

## Environment
Time: ${ctx.environment.time}
Hour: ${ctx.environment.hour}
Weather: ${ctx.environment.weather}

## Recent Plays
${ctx.memory.recentPlays.map(p => `- ${p.track_title} by ${p.track_artist}`).join('\n') || 'None'}

## YOUR CAPABILITIES (IMPORTANT)
You ARE the DJ of this radio app. When you return a \`play\` array in JSON, the
app AUTOMATICALLY ADDS those tracks to the user's playlist — you don't need
the user to do anything. NEVER say "I can't add songs" or "please add them
yourself". You absolutely can.

## CRITICAL RULE: tracks must live in the \`play\` array
If you mention ANY specific track or artist recommendation in your reply —
even just one song name — you MUST include it in the \`play\` array of a JSON
response. The app does NOT parse track names out of prose. If you write
"I added Sawayaka by Nujabes" in plain text without a play array, the user
WILL NOT see or hear that track. This is a hard contract: prose mentions
without a play array = silent failure that frustrates the user.

## When to use structured JSON  (HARD CONTRACT — read carefully)
ANY message that recommends, adds, or names music → reply MUST be JSON.
No exceptions, no preamble, no "Here are some tracks" without the JSON
wrapping it. The user does NOT see your prose recommendations as music —
they only see what's in the play array. A reply like "Here are some
iconic Jay Chou tracks for you!" without a play array is a BUG: the user
sees the sentence and gets nothing.

Trigger phrases that ALWAYS require JSON with play[] (Chinese + English):
- "推薦" / "recommend" / "suggest" / "pick" / "play"
- "幾首" / "some songs" / "a few tracks" / any artist name + "songs"
- "給我" / "give me" / "I want" / "let's hear"
- Naming any artist (Jay Chou, Nujabes, Tycho, etc.) → return their tracks

REQUIRED JSON shape (return ONLY this object — no surrounding text):
{
  "say":    "<one short spoken sentence, friendly, English>",
  "play":   [{"title": "exact track title", "artist": "original artist"}, ...],
  "reason": "<one short line explaining why these fit, English>"
}

Rules for \`play\`:
- Always include the ORIGINAL artist (not cover singer) to avoid AI-covers.
- Prefer the artist's best-known recording of each song.
- Provide 3-6 tracks for "推薦" / "recommend" / "幾首" requests
  (more than 1 unless user explicitly asked for one).
- If user just names an artist with no verb ("周杰倫", "Nujabes"), assume
  recommend → return JSON with 4-5 of their canonical tracks.

Plain text replies are ONLY for genuine chat with ZERO song mentions
(e.g. "how's the weather?", "tell me about jazz history", "hi", "thanks").`

      const llmMessages = [
        { role: 'system', content: systemContent },
        ...history.map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: message }
      ]

      // Call LLM with provider selection
      const response = await chat(requestedProvider || 'kimi', llmMessages, {
        temperature: 0.8,
        maxTokens: 800
      })

      const assistantContent = response.content

      // Use structured from mock provider if present, otherwise try to parse
      let structured = response.structured || null
      if (!structured) {
        try {
          const jsonMatch = assistantContent.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            if (parsed.say || parsed.play) {
              structured = parsed
            }
          }
        } catch (e) {
          // Not structured, treat as plain text
        }
      }

      // Resolve structured recommendations against SoundCloud first, then
      // YT Music if SC misses. Each pick may be a string "title" or
      // an object {title, artist}; filter out cover/karaoke/AI-voice hits.
      if (structured?.play?.length > 0) {
        const queue = []
        for (const item of structured.play) {
          const title = typeof item === 'string' ? item : item?.title
          const artist = typeof item === 'string' ? '' : (item?.artist || '')
          if (!title) continue
          const q = [title, artist].filter(Boolean).join(' ').trim()
          // SC catalog is patchy for non-English / Mandopop / J-pop. Try
          // SC first (preferred — direct stream URLs work), then fall back
          // to YT search for catalog coverage. YT can't actually stream
          // (cipher), but the search hit gives us a track card the user
          // can click to play once we resolve a SC equivalent later.
          let chosen = null
          try {
            const scHits = await music.search(q, 'sc', 6)
            chosen = scHits.find(h => !looksLikeCover(h))
            if (!chosen && scHits.length) chosen = scHits[0]
          } catch (e) {
            console.warn('[chat] SC search failed:', title, e.message)
          }
          if (!chosen) {
            try {
              const ytHits = await music.search(q, 'yt', 4)
              chosen = ytHits.find(h => !looksLikeCover(h))
              if (!chosen && ytHits.length) chosen = ytHits[0]
              if (chosen) console.log(`[chat] YT fallback hit: ${chosen.title} — ${chosen.artist}`)
            } catch (e) {
              console.warn('[chat] YT search failed:', title, e.message)
            }
          }
          if (chosen) queue.push(chosen)
          else console.warn(`[chat] no SC/YT hit for "${q}"`)
        }
        structured.queue = queue
        // Two-stage prefetch:
        // 1) AWAIT prefetch of the first track (most likely click) with a
        //    12s ceiling — ensures the most common user action ("click the
        //    top recommendation") lands instantly. Adds ~9s to chat
        //    response time, but that's hidden inside "spinning the decks"
        //    and feels less broken than a 9s pause AFTER clicking.
        // 2) Fire-and-forget SEQUENTIAL prefetch for the rest. Parallel
        //    spawns were swamping the system (5 concurrent yt-dlp processes
        //    all timed out at 30s).
        if (queue[0]?.source && queue[0]?.sourceId) {
          const first = queue[0]
          await Promise.race([
            music.getUrl({ source: first.source, sourceId: first.sourceId, title: first.title, artist: first.artist })
              .catch(() => null),
            new Promise(r => setTimeout(r, 12000))
          ])
        }
        ;(async () => {
          for (let i = 1; i < queue.length; i++) {
            const t = queue[i]
            if (t?.source && t?.sourceId) {
              try {
                await music.getUrl({ source: t.source, sourceId: t.sourceId, title: t.title, artist: t.artist })
              } catch (e) {
                console.warn('[chat] prefetch failed for', t.title, e.message)
              }
            }
          }
        })()
      }

      // Save assistant response
      db.prepare('INSERT INTO messages (role, content) VALUES (?, ?)')
        .run('assistant', assistantContent)

      const result = {
        content: assistantContent,
        role: 'assistant',
        structured,
        usage: response.usage
      }

      // Broadcast to WS clients
      broadcast({
        type: 'chat',
        role: 'assistant',
        content: assistantContent,
        structured
      })

      res.json(result)
    } catch (e) {
      console.error('Chat error:', e)
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/greeting - LLM-generated landing greeting (one-sentence ambient welcome)
  // Different every request. Used by the Landing overlay before the user has
  // done anything — keep it short, spoken-style, and grounded in the moment.
  app.post('/api/greeting', async (req, res) => {
    const ctx = buildContext(db, { weather: req.body?.weather })

    // Speed over depth for the opening greeting — prefer non-reasoning models.
    const configured = getProviderStatus()
      .filter(p => p.configured && !p.isMock)
      .map(p => p.name)
    const speedPriority = ['kimi', 'openai', 'claude', 'minimax']
    const tryOrder = speedPriority.filter(p => configured.includes(p))
    if (tryOrder.length === 0) tryOrder.push('mock')

    const sys = `You are an AI DJ greeting a listener as they open their radio.
LANGUAGE: respond in English only. No exceptions.
Write ONE short spoken welcome, 8-18 words, no quotation marks, no self-intro,
no track talk — just an ambient, intimate opening that fits the current moment.
Vary style across requests: sometimes poetic, sometimes plain, sometimes wry.
Current moment: ${ctx.environment.time}, hour ${ctx.environment.hour}, weather ${ctx.environment.weather}.
Return ONLY the greeting sentence. No prefix, no explanation.`

    for (const providerName of tryOrder) {
      try {
        const response = await Promise.race([
          chat(providerName, [
            { role: 'system', content: sys },
            { role: 'user', content: 'Say hello.' }
          ], { temperature: 0.95, maxTokens: 600 }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 6s')), 6000))
        ])
        // Reasoning models (MiniMax-M2) may spend tokens on internal thought
        // and occasionally return the greeting split across lines with stray
        // quotes/prefixes — strip them so TTS gets a clean sentence.
        let text = (response.content || '').trim()
        text = text.replace(/^["'`\s]+|["'`\s]+$/g, '')
        // If model returned multi-line, take the first non-empty line
        const firstLine = text.split('\n').map(s => s.trim()).find(Boolean)
        text = firstLine || text
        if (text) {
          console.log(`[greeting] provider=${providerName} → "${text}"`)
          return res.json({ greeting: text })
        }
        console.warn(`[greeting] ${providerName} returned empty content (raw="${(response.content || '').slice(0, 200)}")`)
      } catch (e) {
        console.warn(`[greeting] ${providerName} failed: ${e.message}`)
      }
    }
    // All providers failed — return a static fallback so UI never blocks
    res.json({ greeting: "Welcome back. Let's see what tonight sounds like." })
  })

  // GET /api/ambient - weather-matched background ambient track. Uses wttr.in
  // (free, no key) to detect the current weather, then searches SoundCloud
  // for an appropriate ambient/nature loop.
  app.get('/api/ambient', async (req, res) => {
    const city = req.query.city || 'Tokyo'
    try {
      // Free weather API, no auth. Short timeout so failures don't hang UI.
      let conditionRaw = 'clear'
      try {
        const wRes = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=%C`, { signal: AbortSignal.timeout(4000) })
        if (wRes.ok) {
          const txt = (await wRes.text()).trim().toLowerCase()
          if (txt) conditionRaw = txt
        }
      } catch (e) {
        console.warn('[ambient] weather fetch failed:', e.message)
      }

      // Map weather condition → mood → SC search query
      const c = conditionRaw
      let mood, query
      if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) {
        mood = 'rainy'; query = 'gentle rain ambient loop'
      } else if (c.includes('snow') || c.includes('sleet')) {
        mood = 'snowy'; query = 'snow ambient warm cabin'
      } else if (c.includes('thunder') || c.includes('storm')) {
        mood = 'stormy'; query = 'thunderstorm ambient rain'
      } else if (c.includes('clear') || c.includes('sunny') || c.includes('fair')) {
        mood = 'sunny'; query = 'sunny morning ambient acoustic'
      } else if (c.includes('cloud') || c.includes('overcast')) {
        mood = 'cloudy'; query = 'cloudy day ambient lofi instrumental'
      } else if (c.includes('fog') || c.includes('mist') || c.includes('haze')) {
        mood = 'foggy'; query = 'foggy morning ambient peaceful'
      } else {
        mood = 'chill'; query = 'chill ambient instrumental loop'
      }

      // Search SC for a matching track, then resolve a stream URL
      const tracks = await music.search(query, 'sc', 3)
      for (const t of tracks) {
        try {
          const url = await music.getUrl({ source: 'sc', sourceId: String(t.sourceId), title: t.title, artist: t.artist })
          if (url) {
            console.log(`[ambient] weather=${mood} track="${t.title}" by ${t.artist}`)
            return res.json({ weather: conditionRaw, mood, track: t, url })
          }
        } catch { /* try next hit */ }
      }
      res.json({ weather: conditionRaw, mood, track: null, url: null })
    } catch (e) {
      console.error('[ambient] error:', e)
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/track-story - short story + artist bio for the currently
  // playing track. Used by the MusicalStory panel. Cached per track since
  // the facts don't change session-to-session.
  const storyCache = new Map()  // key: `${title}::${artist}` → { trackStory, artistBio }
  app.post('/api/track-story', async (req, res) => {
    const { title, artist, deep = false } = req.body || {}
    if (!title) return res.status(400).json({ error: 'title required' })
    const key = `${title}::${artist || ''}::${deep ? 'deep' : 'short'}`.toLowerCase()
    if (storyCache.has(key)) return res.json(storyCache.get(key))

    const configured = getProviderStatus()
      .filter(p => p.configured && !p.isMock).map(p => p.name)
    const tryOrder = ['kimi', 'openai', 'claude', 'minimax'].filter(p => configured.includes(p))
    if (tryOrder.length === 0) tryOrder.push('mock')

    const sys = deep
      ? `You're a music geek friend. Tell the listener everything interesting
about this specific track in 4-6 paragraphs. Mix fact + feel:
- Year, label, where/how it was recorded if known
- Notable players, samples, collaborators
- The texture & production choices (instruments, mixing, mood)
- Cultural context (scene, era, what it sat alongside)
- Why it's worth a close listen — what to notice
Conversational tone, like talking late at night to a friend who loves music.
LANGUAGE: respond in English only, regardless of track origin or user language.
Return ONLY plain text. No JSON, no headers, no markdown.

Track: "${title}"${artist ? ` by ${artist}` : ''}.`
      : `You provide concise factual music liner notes in English only.
Return ONLY this JSON (no prose, no code fence):
{
  "trackStory": "<2 sentences about this specific track — what it feels like, notable production details, collaborators if known. Conversational, warm. ENGLISH ONLY.>",
  "artistBio":  "<2-3 sentences about the artist — origin, era, sound, influence. Matter-of-fact. ENGLISH ONLY.>"
}
If you don't know the track for sure, give a thoughtful description based on the title + artist that still reads like liner notes; never say "I don't know".

Track: "${title}"${artist ? ` by ${artist}` : ''}.`

    for (const providerName of tryOrder) {
      try {
        const response = await Promise.race([
          chat(providerName, [
            { role: 'system', content: sys },
            { role: 'user', content: deep ? 'Tell me everything good about this track.' : 'Write the notes.' }
          ], {
            temperature: 0.75,
            maxTokens: providerName === 'minimax' ? (deep ? 2400 : 1200) : (deep ? 1200 : 400)
          }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')),
            providerName === 'minimax' ? (deep ? 20000 : 10000) : (deep ? 12000 : 5000)))
        ])
        if (deep) {
          const text = (response.content || '').trim()
          if (text) {
            const out = { djTake: text }
            storyCache.set(key, out)
            return res.json(out)
          }
        } else {
          let parsed = response.structured
          if (!parsed) {
            const raw = (response.content || '').replace(/```(?:json)?\s*|\s*```/g, '')
            const m = raw.match(/\{[\s\S]*\}/)
            if (m) { try { parsed = JSON.parse(m[0]) } catch {} }
          }
          if (parsed?.trackStory && parsed?.artistBio) {
            storyCache.set(key, parsed)
            return res.json(parsed)
          }
        }
      } catch (e) {
        console.warn(`[story] ${providerName} failed: ${e.message}`)
      }
    }
    if (deep) {
      return res.json({ djTake: `"${title}"${artist ? ` by ${artist}` : ''} — sit with this one for a minute. The kind of track that earns its space.` })
    }
    res.json({
      trackStory: `"${title}"${artist ? ` by ${artist}` : ''} — one of those tracks that meets you in the moment.`,
      artistBio: artist ? `${artist} — craft, consistency, a sound you recognize by the second bar.` : 'A piece worth letting play.'
    })
  })

  // POST /api/dj-monologue - 6-beat DJ opening narration for the first track
  // of a curated set. Each beat is one spoken line in a specific role
  // (identity, moment, origin, sensation, title, closer). Front-end plays
  // them sequentially via TTS while rendering a stacked transcript with
  // per-word highlighting like the reference video.
  app.post('/api/dj-monologue', async (req, res) => {
    const { track, userContext = '' } = req.body || {}
    if (!track?.title) {
      return res.status(400).json({ error: 'track.title is required' })
    }
    const ctx = buildContext(db, { weather: req.body?.weather })

    // For the monologue, PREFER non-reasoning fast models — this task doesn't
    // need deep reasoning and MiniMax-M2's thinking tokens add 10s+ of latency.
    // Kimi (moonshot-v1-8k) / OpenAI are ~3-5x faster for this kind of writing.
    const configured = getProviderStatus()
      .filter(p => p.configured && !p.isMock)
      .map(p => p.name)
    const speedPriority = ['kimi', 'openai', 'claude', 'minimax']
    const tryOrder = speedPriority.filter(p => configured.includes(p))
    if (tryOrder.length === 0) tryOrder.push('mock')

    const sys = `You are Kimi, an intimate AI radio DJ.
LANGUAGE: every beat must be in English. No Chinese, Japanese, or any
other language — even if the track or artist comes from a non-English
source, the spoken monologue stays English.

Every session opens
with a short spoken monologue (total 15-25 seconds aloud) introducing the
first track. Write the monologue as 6 labeled beats in order.

## The 6 beats (strictly in this order)

1. IDENTITY — REQUIRED opener: literally "This is Kimi Radio." (no variants —
   the listener should always hear the same brand line at start of show)
2. MOMENT — anchor the listener in time + hint at what the song gives.
   "It's {time_context}, and here's a song that {sensory_promise}."
3. ORIGIN — ONE concrete historical fact about the song/artist, told like
   a close friend would. Must contain a sensory detail (instrument, year,
   room, action). Do NOT read like Wikipedia.
4. SENSATION — in 2nd person, what the listener will FEEL.
   "You'll feel yourself {physical_verb} {sensory_image}."
5. TITLE — reveal the song casually. "This one's called {title}."
6. CLOSER — one line meeting the listener in their own context
   (time of day, week, mood, work).

## Voice rules (hard)

- Intimate, quiet, unhurried — like someone sitting with the listener
- Short sentences, one strong verb each
- Concrete nouns over generic ones ("nylon-string guitar" not "guitar")
- NO hype adjectives (amazing / beautiful / incredible / wonderful)
- NO clichés ("so, let's dive in", "without further ado", "buckle up")
- Sentence fragments OK; lowercase openings OK
- Each beat 1 sentence, occasionally 2 if truly needed
- Whole monologue stays under 80 words

## Inputs

- Current time: ${ctx.environment.time}, hour ${ctx.environment.hour}
- Weather: ${ctx.environment.weather}
- Track: "${track.title}" by ${track.artist || 'unknown'}${track.year ? `, ${track.year}` : ''}
- User context: ${userContext || '(none provided)'}

## Output

Return ONLY valid JSON, no prose, no code fence:
{
  "identity":  "...",
  "moment":    "...",
  "origin":    "...",
  "sensation": "...",
  "title":     "...",
  "closer":    "..."
}`

    for (const providerName of tryOrder) {
      try {
        // Per-provider timeout: fast models short, reasoning models longer
        // (MiniMax-M2 needs thinking budget). If all fail we use a curated
        // template fallback so the UI never stalls.
        const maxTokens = providerName === 'minimax' ? 1800 : 600
        const timeoutMs = providerName === 'minimax' ? 12000 : 6000
        const response = await Promise.race([
          chat(providerName, [
            { role: 'system', content: sys },
            { role: 'user', content: 'Write tonight\'s opening monologue.' }
          ], { temperature: 0.9, maxTokens }),
          new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${timeoutMs/1000}s`)), timeoutMs))
        ])

        let parsed = response.structured
        if (!parsed) {
          // Strip markdown fence, find the first {...} block
          const raw = (response.content || '').replace(/```(?:json)?\s*|\s*```/g, '')
          const m = raw.match(/\{[\s\S]*\}/)
          if (m) { try { parsed = JSON.parse(m[0]) } catch { parsed = null } }
        }
        if (parsed?.identity && parsed?.title) {
          console.log(`[monologue] provider=${providerName} ok`)
          return res.json({ beats: parsed })
        }
        console.warn(`[monologue] ${providerName} unparsable (raw="${(response.content || '').slice(0, 200).replace(/\n/g, ' ')}")`)
      } catch (e) {
        console.warn(`[monologue] ${providerName} failed: ${e.message}`)
      }
    }

    // Fallback — curated template that still reads personal. Uses time,
    // weather, user context, track metadata. Multiple phrasings per slot so
    // it varies a bit across sessions.
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
    const hour = ctx.environment.hour
    const timeLabel =
      hour < 5  ? 'the small hours' :
      hour < 9  ? 'an early morning' :
      hour < 12 ? 'a quiet morning' :
      hour < 14 ? 'midday' :
      hour < 17 ? 'the late afternoon' :
      hour < 20 ? 'an early evening' :
      hour < 23 ? 'a late evening' :
                  'the night'
    const artist = track.artist || 'whoever made this'
    const title = track.title
    const year = track.year ? ` back in ${track.year}` : ''

    res.json({
      beats: {
        identity: 'This is Kimi Radio.',
        moment: pick([
          `It's ${timeLabel}, and here's something to meet you where you are.`,
          `${timeLabel.charAt(0).toUpperCase() + timeLabel.slice(1)}, and this one's waiting for you.`,
          `It's ${timeLabel}, and the room's ready for this one.`
        ]),
        origin: pick([
          `${artist} made this${year} the way you make something you actually care about — slow, careful.`,
          `${artist} put this together${year}, and you can hear the hands in it.`,
          `This one's from ${artist}${year}, built the way good things get built — a little at a time.`
        ]),
        sensation: pick([
          `You'll feel your shoulders drop about a minute in.`,
          `You'll feel it pull the day down to a softer pitch.`,
          `You'll feel yourself settle — nothing dramatic, just a little gentler.`
        ]),
        title: pick([
          `This one's called '${title}'.`,
          `The track is '${title}'.`,
          `'${title}' — that's the one.`
        ]),
        closer: pick([
          userContext ? `${userContext}. Just let this one play.` : `Just let this one play.`,
          `Wherever the day left you, this is a good place to land.`,
          `Breathe in on the downbeat. Here we go.`
        ])
      }
    })
  })

  // GET /api/tts-stream - realtime streaming TTS. Audio bytes start flowing
  // to the client as Edge TTS synthesizes them (no wait for full file).
  // Used as an <audio> src so browsers begin playback in ~500ms regardless
  // of clip length.
  // GET /api/today-context - one-shot bundle of "boot diagnostic" data:
  // weather, temperature, sunrise/sunset. Cached in-memory for 10 min so
  // the diagnostic overlay doesn't re-hit wttr.in on every refresh.
  const ctxCache = new Map()
  app.get('/api/today-context', async (req, res) => {
    const city = req.query.city || 'Tokyo'
    const cached = ctxCache.get(city)
    const now = Date.now()
    if (cached && now - cached.ts < 10 * 60 * 1000) return res.json(cached.data)
    try {
      const r = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`,
        { signal: AbortSignal.timeout(5000) })
      if (!r.ok) throw new Error(`wttr ${r.status}`)
      const j = await r.json()
      const cur = j.current_condition?.[0] || {}
      const today = j.weather?.[0] || {}
      const astronomy = today.astronomy?.[0] || {}
      const data = {
        city,
        weather: cur.weatherDesc?.[0]?.value || 'unknown',
        temperatureC: parseInt(cur.temp_C, 10),
        feelsLikeC:   parseInt(cur.FeelsLikeC, 10),
        sunrise: astronomy.sunrise || '',
        sunset:  astronomy.sunset  || ''
      }
      ctxCache.set(city, { ts: now, data })
      res.json(data)
    } catch (e) {
      console.warn('[today-context] failed:', e.message)
      res.status(200).json({ city, weather: 'unknown', temperatureC: null, sunrise: '', sunset: '' })
    }
  })

  // POST /api/playlist/curate-day - batch curate all 7 time blocks in a
  // single LLM call, with a coherent narrative arc across the day. Used by
  // the BootDiagnostic flow so all blocks light up "ready" once the batch
  // resolves. Falls back to lazy per-block curation on failure.
  app.post('/api/playlist/curate-day', async (req, res) => {
    const { provider: requestedProvider, taste: clientTaste, calendarUrls, perBlock = 6 } = req.body || {}
    const ctx = buildContext(db, { weather: req.body?.weather })

    // Calendar abstraction (privacy-stripped) — same rule as single curate:
    // skip the calendar section entirely if there are no events.
    let calendarLine = ''
    try {
      if (Array.isArray(calendarUrls) && calendarUrls.filter(Boolean).length > 0) {
        const summary = await getAbstractToday(calendarUrls)
        const blockIds = Object.keys(summary)
        if (blockIds.length > 0) {
          const parts = blockIds.map(bid => {
            const { count, busyMinutes } = summary[bid]
            return `${bid}: ${count} ${count === 1 ? 'event' : 'events'} (~${busyMinutes} min)`
          })
          calendarLine = `\nToday's calendar (per block, busy minutes only — no titles): ${parts.join('; ')}`
        }
      }
    } catch (e) { console.warn('[curate-day] calendar skipped:', e.message) }

    const formatClientTaste = (t) => {
      if (!t || typeof t !== 'object') return ''
      const parts = []
      if (Array.isArray(t.genres) && t.genres.length) parts.push(`Genres: ${t.genres.join(', ')}`)
      if (Array.isArray(t.vibes)  && t.vibes.length)  parts.push(`Vibes: ${t.vibes.join(', ')}`)
      if (typeof t.artists === 'string' && t.artists.trim()) parts.push(`Favorite artists: ${t.artists.trim()}`)
      return parts.join(' / ')
    }
    const declaredTaste = formatClientTaste(clientTaste)

    const sys = `You are an AI DJ designing TODAY'S RADIO — a single coherent show
that flows naturally across 7 time blocks. Pick exactly ${perBlock} tracks per block.

LANGUAGE: all text fields ("narrative", every "say") in English only.
Adjacent blocks should connect tonally; the day should feel like one curated mixtape.

Time blocks with mood guides (HARD CONSTRAINT — picks must match the vibe):
- late-night    (00-05): hushed, minimal — soft piano, deep ambient, ≤95 BPM. NO loud or upbeat.
- early-morning (05-09): gentle wake — acoustic, warm, slow tempo. NO heavy beats or harsh vocals.
- morning       (09-12): instrumental momentum — lofi hip-hop, post-rock, mellow jazz. NO lyric-heavy distractions.
- midday        (12-14): easy reset — soft electronic, breezy bossa, mellow soul. Light, social.
- afternoon     (14-17): steady rhythm — chill house, jazz hop, indie pop, neo-soul. Even energy.
- early-evening (17-20): soft transition — ambient electronic, soulful R&B, acoustic. NO ramp-ups.
- evening       (20-23): atmospheric — neo-soul, downtempo, deep cuts. More sonic depth than afternoon.

Day's narrative arc: gentle wake → focused momentum → easy reset → steady afternoon →
soft wind-down → atmospheric night. Picks must support this arc.

Listener profile:
${declaredTaste ? `- Declared: ${declaredTaste}` : ''}
${ctx.taste ? `- Taste: ${ctx.taste}` : ''}
- Weather: ${ctx.environment.weather}${calendarLine}

Resolution rules:
- Always include the ORIGINAL artist (not cover singer) — avoid AI-cover hits.
- Diversity: don't pick more than 2 tracks from the same artist across the WHOLE day.
- Skip Nujabes-Feather and Nujabes-Luv(sic) (overplayed defaults).

Respond ONLY with valid JSON, no markdown fence:
{
  "narrative": "<2 sentences describing today's musical arc>",
  "blocks": {
    "late-night":    {"say": "<short DJ intro>", "picks": [{"title":"...","artist":"..."}, ...]},
    "early-morning": {"say": "...", "picks": [...]},
    "morning":       {"say": "...", "picks": [...]},
    "midday":        {"say": "...", "picks": [...]},
    "afternoon":     {"say": "...", "picks": [...]},
    "early-evening": {"say": "...", "picks": [...]},
    "evening":       {"say": "...", "picks": [...]}
  }
}`

    const configuredProviders = getProviderStatus()
      .filter(p => p.configured && !p.isMock).map(p => p.name)
    const tryOrder = []
    if (requestedProvider && configuredProviders.includes(requestedProvider)) tryOrder.push(requestedProvider)
    for (const p of configuredProviders) if (!tryOrder.includes(p)) tryOrder.push(p)
    if (!tryOrder.length) return res.status(503).json({ error: 'no LLM providers configured' })

    let response = null
    let lastErr = null
    for (const providerName of tryOrder) {
      try {
        response = await chat(providerName, [
          { role: 'system', content: sys },
          { role: 'user', content: 'Compose today\'s set across all 7 blocks now.' }
        ], { temperature: 0.85, maxTokens: 4500 })
        console.log(`[curate-day] provider=${providerName} ok`)
        break
      } catch (e) {
        lastErr = e
        console.warn(`[curate-day] ${providerName} failed: ${e.message}`)
      }
    }
    if (!response) return res.status(502).json({ error: lastErr?.message || 'all providers failed' })

    let parsed = response.structured
    if (!parsed) {
      const m = (response.content || '').match(/\{[\s\S]*\}/)
      if (m) { try { parsed = JSON.parse(m[0]) } catch { parsed = null } }
    }
    if (!parsed?.blocks) return res.status(502).json({ error: 'unparseable LLM response' })

    // Resolve picks against SoundCloud per block, in parallel within each
    // block but serialized across blocks to avoid hammering SC. Reuse the
    // looksLikeCover filter from the single-block curate.
    const blocksOut = {}
    const blockIds = Object.keys(parsed.blocks)
    for (const bid of blockIds) {
      const b = parsed.blocks[bid]
      if (!b?.picks?.length) { blocksOut[bid] = { say: b?.say || '', queue: [] }; continue }
      const resolved = await Promise.all(b.picks.map(async (item) => {
        const title = typeof item === 'string' ? item : item?.title
        const artist = typeof item === 'string' ? '' : (item?.artist || '')
        if (!title) return null
        try {
          const hits = await music.search([title, artist].filter(Boolean).join(' ').trim(), 'sc', 6)
          let chosen = hits.find(h => !looksLikeCover(h)) || hits[0]
          return chosen || null
        } catch { return null }
      }))
      blocksOut[bid] = { say: b.say || '', queue: resolved.filter(Boolean) }
    }

    res.json({
      source: 'ai',
      narrative: parsed.narrative || '',
      blocks: blocksOut
    })
  })

  // POST /api/calendar/events - fetch today's events from public ICS feeds.
  // Body: { urls: string[] }. URLs may be webcal:// or https://; the
  // calendar module normalizes. Returns rich event objects (title kept
  // for UI display). The privacy-stripped form is fetched server-side
  // when curating, so titles never reach the LLM.
  app.post('/api/calendar/events', async (req, res) => {
    const urls = Array.isArray(req.body?.urls) ? req.body.urls : []
    if (!urls.length) return res.json({ events: [] })
    try {
      const events = await getEventsToday(urls)
      res.json({ events })
    } catch (e) {
      console.error('[calendar/events] error:', e.message)
      res.status(500).json({ error: e.message, events: [] })
    }
  })

  app.get('/api/tts-stream', async (req, res) => {
    const text = req.query.text
    if (!text) return res.status(400).end()
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'public, max-age=604800')
    try {
      await streamSpeechTo(String(text), res)
    } catch (e) {
      console.error('[tts-stream] error:', e.message)
      if (!res.headersSent) res.status(500).end()
      else { try { res.end() } catch {} }
    }
  })

  // POST /api/tts - text to speech
  app.post('/api/tts', async (req, res) => {
    const { text } = req.body
    if (!text) {
      return res.status(400).json({ error: 'Text is required' })
    }

    try {
      const audioUrl = await synthesizeSpeech(text)
      res.json({ audioUrl, text })
    } catch (e) {
      console.error('TTS error:', e)
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/play - log play event
  app.post('/api/play', (req, res) => {
    const { track_id, track_title, track_artist, duration } = req.body
    db.prepare('INSERT INTO plays (track_id, track_title, track_artist, duration) VALUES (?, ?, ?, ?)')
      .run(track_id, track_title, track_artist, duration)

    broadcast({
      type: 'now-playing',
      track: { track_id, track_title, track_artist, duration }
    })

    res.json({ success: true })
  })
}
