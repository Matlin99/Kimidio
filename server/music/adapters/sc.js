import { Soundcloud } from 'soundcloud.ts'

let scInstance = null

function getSC() {
  if (!scInstance) scInstance = new Soundcloud()
  return scInstance
}

function pickCover(track) {
  // SC returns 500x500 by default in artwork_url; upgrade to t500x500 if small
  const art = track.artwork_url || track.user?.avatar_url || ''
  return art.replace('-large.jpg', '-t500x500.jpg')
}

function formatTrack(track) {
  return {
    id: `sc:${track.id}`,
    source: 'sc',
    sourceId: String(track.id),
    title: track.title || '',
    artist: track.user?.username || track.publisher_metadata?.artist || '',
    album: track.publisher_metadata?.album_title || '',
    cover: pickCover(track),
    duration: Math.floor((track.duration || 0) / 1000),
    url: null,
    permalink: track.permalink_url || null,
  }
}

export async function search(keyword, limit = 10) {
  try {
    const sc = getSC()
    const results = await sc.tracks.searchAlt(keyword)
    return (results || []).slice(0, limit).map(formatTrack)
  } catch (e) {
    console.error('[SC] search error:', e.message)
    return []
  }
}

export async function getUrl(sourceId) {
  try {
    const sc = getSC()
    // streamLink expects string (resolvable id or permalink URL) or a full Track
    const url = await sc.util.streamLink(String(sourceId), 'progressive')
    return url || null
  } catch (e) {
    console.error('[SC] getUrl error:', e.message)
    return null
  }
}

export async function getDetail(sourceId) {
  try {
    const sc = getSC()
    const track = await sc.tracks.get(Number(sourceId))
    return track ? formatTrack(track) : null
  } catch (e) {
    console.error('[SC] getDetail error:', e.message)
    return null
  }
}

// Cover / karaoke / instrumental / loop detector. Same heuristic the
// chat resolver uses but localized here so resolveByNameArtist filters
// upstream of the consumer.
const NOISE_RE = /\b(cover|covered|karaoke|instrumental|piano version|guitar version|live performance|tribute|remix|sped up|slowed|nightcore|reverb|10 hours?|1 hour|loop)\b/i

function looksLikeNoise(track) {
  if (!track) return true
  if (NOISE_RE.test(track.title || '')) return true
  if (NOISE_RE.test(track.artist || '')) return true
  // 1-hour-loop bait: anything > 15 min when target is a normal pop song
  if (track.duration > 900) return true
  return false
}

// Score a candidate against the target — higher is better.
// Closeness of duration matters most (songs are typically 2-5 min and
// SC has lots of "snippet" 30s clips and hour-long mixes that we want
// to skip), then title token overlap, then artist match.
function scoreCandidate(c, target) {
  let score = 0
  if (target.duration && c.duration) {
    const diff = Math.abs(c.duration - target.duration)
    if (diff < 5) score += 50
    else if (diff < 15) score += 30
    else if (diff < 30) score += 10
    else if (diff > 60) score -= 20
  }
  const tNorm = (target.title || '').toLowerCase()
  const cTitle = (c.title || '').toLowerCase()
  if (tNorm && cTitle.includes(tNorm)) score += 25
  const aNorm = (target.artist || '').toLowerCase()
  const cArtist = (c.artist || '').toLowerCase()
  if (aNorm && cArtist.includes(aNorm)) score += 20
  return score
}

// Resolve a track from another source (e.g. YT Music) on SoundCloud by
// title+artist, return playable stream URL if found. Used as the fallback
// path when YT returns search results but no playable cipher.
//
// Multi-query strategy: SC's search is finicky with CJK + non-Latin
// characters — different combinations have wildly different hit rates.
// Try several variations, then score the union of results to pick the
// best candidate (closest duration, cleanest title, no cover/karaoke).
export async function resolveByNameArtist(title, artist, hints = {}) {
  const targetDuration = hints.duration || 0
  const queries = [
    [title, artist].filter(Boolean).join(' '),  // "晴天 周杰倫"
    artist ? `${artist} ${title}` : null,        // "周杰倫 晴天"
    title,                                       // just title
  ].filter(Boolean).map(q => q.trim()).filter(Boolean)

  const seen = new Set()
  const candidates = []
  for (const q of queries) {
    try {
      const results = await search(q, 8)
      for (const r of results) {
        if (!r?.sourceId || seen.has(r.sourceId)) continue
        if (looksLikeNoise(r)) continue
        seen.add(r.sourceId)
        candidates.push(r)
      }
      if (candidates.length >= 6) break  // enough to pick from
    } catch (e) {
      console.warn(`[SC.resolve] query "${q}" failed:`, e.message)
    }
  }

  if (!candidates.length) {
    console.warn(`[SC.resolve] no candidates for "${title}" / "${artist}"`)
    return null
  }

  candidates.sort((a, b) =>
    scoreCandidate(b, { title, artist, duration: targetDuration }) -
    scoreCandidate(a, { title, artist, duration: targetDuration })
  )
  const best = candidates[0]
  const url = await getUrl(best.sourceId)
  if (!url) {
    console.warn(`[SC.resolve] best candidate ${best.sourceId} ("${best.title}") has no stream URL`)
    return null
  }
  console.log(`[SC.resolve] ${title} / ${artist} → sc:${best.sourceId} "${best.title}" by "${best.artist}" (${best.duration}s)`)
  return { trackId: best.sourceId, url, title: best.title, artist: best.artist }
}
