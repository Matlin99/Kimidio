import * as local from './local.js'
import * as sc from './sc.js'
import * as yt from './yt.js'

const adapters = { local, sc, yt }

export async function search(keyword, source = 'sc', limit = 10) {
  const adapter = adapters[source]
  if (!adapter) throw new Error(`Unknown music source: ${source}`)
  return adapter.search(keyword, limit)
}

export async function getUrl(track) {
  const adapter = adapters[track.source]
  if (!adapter) return null
  const url = await adapter.getUrl(track.sourceId)
  if (url) return url

  // Fallback chain when the primary source can't return a playable URL
  // (e.g. region-blocked YT video, age-restricted, or removed): try the
  // other web source by title+artist before giving up.
  if (!track.title) {
    console.warn(`[fallback] SKIPPED ${track.source}:${track.sourceId} (no title in request — frontend may be stale, hard-reload recommended)`)
    return null
  }

  // YT primary → SC fallback. Pass YT's duration as a matching hint so
  // SC's resolver scores candidates against the right target length
  // (avoids picking a 30s snippet or a 1-hour loop with the same title).
  if (track.source === 'yt') {
    console.log(`[fallback] yt:${track.sourceId} "${track.title}" → searching SC (target ${track.duration || '?'}s)`)
    const match = await sc.resolveByNameArtist(track.title, track.artist, { duration: track.duration })
    if (match?.url) {
      console.log(`[fallback] → SC ${match.trackId} ok`)
      return match.url
    }
    console.warn(`[fallback] SC miss for "${track.title}" by "${track.artist}"`)
    return null
  }

  // SC primary → YT fallback
  if (track.source === 'sc') {
    console.log(`[fallback] sc:${track.sourceId} "${track.title}" → searching YT`)
    const match = await yt.resolveByNameArtist(track.title, track.artist)
    if (match?.url) {
      console.log(`[fallback] → YT ${match.trackId} ok`)
      return match.url
    }
    console.warn(`[fallback] YT miss for "${track.title}" by "${track.artist}"`)
    return null
  }

  return null
}

export async function getDetail(track) {
  const adapter = adapters[track.source]
  if (!adapter) return null
  return adapter.getDetail(track.sourceId)
}

export async function getLyric(_track) {
  // No lyric source currently configured. If you add one (e.g. lrclib.net,
  // SoundCloud SCRAPE), wire it here.
  return ''
}

export async function initPlaylist(keyword = 'Nujabes', source = 'sc', limit = 10) {
  // Return search results without pre-fetching URLs.
  // URLs are resolved on-demand at play time so we don't burn quotas on
  // tracks the user never gets to.
  return search(keyword, source, limit)
}
