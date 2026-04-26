// ICS calendar fetcher + parser. Accepts a list of public iCal URLs (Apple
// "Public Calendar" links, Google "Secret address in iCal format", etc.),
// fetches each, expands recurrences for the requested day, and returns a
// normalized list of events.
//
// Two consumer shapes:
//   getEventsToday(urls)    → full event objects (title kept for UI)
//   getAbstractToday(urls)  → privacy-stripped summary suitable for LLM
//                             (no titles, just block-level busy info)

import ical from 'node-ical'

// 5-minute cache per URL — Apple's published feeds update slowly anyway,
// no point hammering them on every refresh.
const cache = new Map()  // url → { fetchedAt, parsed }
const TTL_MS = 5 * 60 * 1000

// Apple gives webcal:// links; node-ical needs http(s). Normalize on input
// so the caller can paste the link verbatim.
function normalizeUrl(u) {
  if (!u) return ''
  return String(u).trim().replace(/^webcal:\/\//i, 'https://')
}

async function fetchAndParse(url) {
  const now = Date.now()
  const hit = cache.get(url)
  if (hit && now - hit.fetchedAt < TTL_MS) return hit.parsed
  try {
    // node-ical async fetcher: returns object keyed by UID, values are
    // VEVENT records (or VTIMEZONE etc. — we filter by .type below).
    const parsed = await ical.async.fromURL(url, { timeout: 10_000 })
    cache.set(url, { fetchedAt: now, parsed })
    return parsed
  } catch (e) {
    console.warn('[calendar] fetch failed for', url.slice(0, 60), '…:', e.message)
    return null
  }
}

// Expand recurring events into a single-day occurrence list. node-ical
// stores the rule on the master VEVENT; we use rrule to iterate occurrences
// that overlap [dayStart, dayEnd] and substitute exceptions.
function occurrencesOnDay(event, dayStart, dayEnd) {
  const out = []
  if (!event.start || !event.end) return out
  const baseStart = new Date(event.start)
  const baseEnd   = new Date(event.end)
  const baseDur   = baseEnd - baseStart

  if (event.rrule) {
    // Pull occurrences whose START falls in the day. between() is inclusive
    // — pad lookback so a meeting that started yesterday but spills into
    // today's morning still surfaces.
    const lookback = new Date(dayStart.getTime() - baseDur)
    const dates = event.rrule.between(lookback, dayEnd, true)
    for (const occStart of dates) {
      // Skip exceptions for cancelled/moved instances
      const exKey = occStart.toISOString().slice(0, 10)
      if (event.exdate && event.exdate[exKey]) continue
      const start = new Date(occStart)
      const end   = new Date(start.getTime() + baseDur)
      // Final overlap guard
      if (end <= dayStart || start >= dayEnd) continue
      out.push({ start, end, summary: event.summary || '(untitled)' })
    }
  } else {
    if (baseEnd <= dayStart || baseStart >= dayEnd) return out
    out.push({ start: baseStart, end: baseEnd, summary: event.summary || '(untitled)' })
  }
  return out
}

function dayBounds(date = new Date()) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

// Map [startHour, endHour] (decimal hours, e.g. 14.5) into the canonical
// 7-block schedule. An event spanning 13:30-15:00 lands in BOTH 'midday'
// (12-14) and 'afternoon' (14-17), so we return all overlapped block ids.
const BLOCK_RANGES = [
  ['late-night',    0,  5],
  ['early-morning', 5,  9],
  ['morning',       9,  12],
  ['midday',        12, 14],
  ['afternoon',     14, 17],
  ['early-evening', 17, 20],
  ['evening',       20, 23],
  ['late-night',    23, 24]
]
function blocksForRange(startHr, endHr) {
  const ids = new Set()
  for (const [id, s, e] of BLOCK_RANGES) {
    if (endHr > s && startHr < e) ids.add(id)
  }
  return [...ids]
}
function hourOf(d) { return d.getHours() + d.getMinutes() / 60 }

export async function getEventsToday(rawUrls) {
  const urls = (rawUrls || []).map(normalizeUrl).filter(Boolean)
  if (!urls.length) return []
  const { start: dayStart, end: dayEnd } = dayBounds()
  const out = []
  for (const url of urls) {
    const parsed = await fetchAndParse(url)
    if (!parsed) continue
    for (const k of Object.keys(parsed)) {
      const ev = parsed[k]
      if (!ev || ev.type !== 'VEVENT') continue
      const occs = occurrencesOnDay(ev, dayStart, dayEnd)
      for (const o of occs) {
        const startHr = hourOf(o.start)
        const endHr   = hourOf(o.end)
        out.push({
          id: `${k}::${o.start.toISOString()}`,
          summary: o.summary,
          start: o.start.toISOString(),
          end:   o.end.toISOString(),
          startHour: startHr,
          endHour:   endHr,
          blocks: blocksForRange(startHr, endHr)
        })
      }
    }
  }
  out.sort((a, b) => a.start.localeCompare(b.start))
  return out
}

// LLM-bound shape: count + total busy minutes per block. No titles, no
// times, no attendees. Frontend keeps the rich version for UI; only this
// abstracted form ever reaches the curate prompt.
export async function getAbstractToday(rawUrls) {
  const events = await getEventsToday(rawUrls)
  const byBlock = {}   // blockId → { count, busyMinutes }
  for (const ev of events) {
    const durMin = Math.max(0, (new Date(ev.end) - new Date(ev.start)) / 60_000)
    for (const bid of ev.blocks) {
      if (!byBlock[bid]) byBlock[bid] = { count: 0, busyMinutes: 0 }
      byBlock[bid].count += 1
      // Distribute the duration across overlapping blocks (rough — split
      // evenly). Good enough for the LLM's "is this block busy?" reading.
      byBlock[bid].busyMinutes += Math.round(durMin / ev.blocks.length)
    }
  }
  return byBlock
}
