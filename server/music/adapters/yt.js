// YouTube Music adapter — SEARCH ONLY.
// Why no streaming: as of late 2025/2026 YouTube ciphers stream URLs in
// a way that no Node library (ytdl-core, @distube/ytdl-core, youtubei.js)
// can reliably decode without running YouTube's player JS in a browser.
// To actually stream YT we'd need to bundle yt-dlp as a subprocess
// binary; until then YT is a discovery layer only.
//
// Pragmatic split: YT Music's catalog is far wider than SoundCloud's
// (especially for Chinese / Japanese / non-English music). YT discovers
// the track, adapters/index.js falls back to SC for the actual stream.
//
// Search source: ytmusic-api hits YT Music's InnerTube endpoint —
// returns OFFICIAL songs (not random videos / lyric channels / 1-hour
// loops / covers). searchSongs() filters out the noise that plain
// youtube-search-api returns, so artist + title metadata is much
// cleaner. That cleanliness directly improves the SC fallback hit
// rate (SC matches better when given the canonical artist string).

import YTMusic from 'ytmusic-api'

let ytmusic = null
async function getYTM() {
  if (!ytmusic) {
    ytmusic = new YTMusic()
    await ytmusic.initialize()
  }
  return ytmusic
}

function bestThumb(thumbnails) {
  if (!Array.isArray(thumbnails) || !thumbnails.length) return ''
  // Pick the largest. YT Music hands them back smallest-first sometimes,
  // sometimes the other way around — sort defensively.
  const sorted = [...thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0))
  return sorted[0]?.url || ''
}

function formatSong(song) {
  return {
    id: `yt:${song.videoId}`,
    source: 'yt',
    sourceId: String(song.videoId),
    title: song.name || '',
    artist: song.artist?.name || '',
    album: song.album?.name || '',
    cover: bestThumb(song.thumbnails),
    duration: song.duration || 0,
    url: null,
    permalink: `https://music.youtube.com/watch?v=${song.videoId}`
  }
}

export async function search(keyword, limit = 10) {
  try {
    const ytm = await getYTM()
    // searchSongs returns YT Music "Songs" results — labelled tracks
    // with proper artist/album metadata, not random video uploads.
    // Falls back to general search if the songs endpoint returns nothing.
    let songs = await ytm.searchSongs(keyword)
    if (!songs?.length) {
      const all = await ytm.search(keyword)
      songs = (all || []).filter(r => r.type === 'SONG')
    }
    return (songs || []).slice(0, limit).map(formatSong)
  } catch (e) {
    console.error('[YT-Music] search error:', e.message)
    return []
  }
}

// Extract a playable audio URL via yt-dlp subprocess. yt-dlp is the only
// reliable path in 2026 — it bundles YouTube's player JS handling and
// the maintainers patch cipher rotations within days, where pure-Node
// libraries (ytdl-core, youtubei.js) lag by months or break permanently.
//
// The Tauri shell injects YTDLP_PATH pointing at the bundled binary
// (src-tauri/binaries/yt-dlp-<triple>). When running the server outside
// Tauri (`npm run dev:server`) YTDLP_PATH is empty and we fall back to
// `yt-dlp` on PATH (assumes a system install).
import { spawn } from 'child_process'

const YTDLP = process.env.YTDLP_PATH && process.env.YTDLP_PATH.trim()
  ? process.env.YTDLP_PATH.trim()
  : 'yt-dlp'

function runYtdlp(args, timeoutMs = 30000) {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let done = false
    const proc = spawn(YTDLP, args)
    const timer = setTimeout(() => {
      if (done) return
      done = true
      try { proc.kill('SIGKILL') } catch {}
      console.warn('[YT.getUrl] yt-dlp timeout')
      resolve(null)
    }, timeoutMs)
    proc.stdout.on('data', d => { stdout += d.toString() })
    proc.stderr.on('data', d => { stderr += d.toString() })
    proc.on('error', (err) => {
      if (done) return
      done = true
      clearTimeout(timer)
      console.error('[YT.getUrl] spawn failed:', err.message, '— is yt-dlp installed?')
      resolve(null)
    })
    proc.on('close', (code) => {
      if (done) return
      done = true
      clearTimeout(timer)
      if (code !== 0) {
        const tail = stderr.split('\n').filter(l => l.trim()).slice(-3).join(' | ')
        console.warn(`[YT.getUrl] yt-dlp exit ${code}: ${tail}`)
        resolve(null)
        return
      }
      // -g prints one URL per line. With -f bestaudio there's exactly one.
      const url = stdout.split('\n').map(l => l.trim()).find(l => l.startsWith('http'))
      resolve(url || null)
    })
  })
}

// In-memory URL cache. yt-dlp takes ~8-12s per call (cipher decode +
// network round-trip), and YouTube stream URLs expire ~6h after issue.
// Cache keyed by videoId, evicted after 5h to stay safely inside the
// expiry window. Also coalesces concurrent in-flight requests so
// multiple simultaneous song/url calls for the same id don't all spawn.
const urlCache = new Map()
const inFlight = new Map()
const CACHE_TTL_MS = 5 * 60 * 60 * 1000

export async function getUrl(sourceId) {
  if (!sourceId) return null
  const now = Date.now()
  const hit = urlCache.get(sourceId)
  if (hit && now - hit.at < CACHE_TTL_MS) {
    return hit.url
  }
  if (inFlight.has(sourceId)) {
    return await inFlight.get(sourceId)
  }
  const promise = (async () => {
    const url = await runYtdlp([
      '-f', 'bestaudio',
      '-g',
      '--no-warnings',
      '--no-check-certificates',
      `https://www.youtube.com/watch?v=${sourceId}`
    ])
    if (url) {
      urlCache.set(sourceId, { url, at: Date.now() })
      console.log(`[YT.getUrl] ok yt:${sourceId} (cached)`)
    }
    return url
  })()
  inFlight.set(sourceId, promise)
  try {
    return await promise
  } finally {
    inFlight.delete(sourceId)
  }
}

// getDetail returns a minimal stub built purely from the videoId. We can't
// call ytdl.getBasicInfo (same cipher problem as getUrl). Callers should
// already have title/artist from the search-time format, so this is rarely
// hit — but kept here for adapter symmetry.
export async function getDetail(sourceId) {
  return {
    id: `yt:${sourceId}`,
    source: 'yt',
    sourceId: String(sourceId),
    title: '',
    artist: '',
    album: '',
    cover: thumb(sourceId),
    duration: 0,
    url: null,
    permalink: `https://www.youtube.com/watch?v=${sourceId}`
  }
}

// resolveByNameArtist disabled because getUrl returns null. Search-only
// flow means YT can't be the final answer of a fallback chain — its job
// is upstream discovery, not last-mile streaming.
export async function resolveByNameArtist(_title, _artist) {
  return null
}
