import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import { createHash } from 'crypto'
import { createReadStream, createWriteStream, existsSync, mkdirSync, unlinkSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// KIMI_CACHE_DIR lets the Tauri shell point at the OS app-cache dir (e.g.
// ~/Library/Caches/Kimi Radio/tts-cache on macOS) so the cache survives
// app updates without writing into the bundle. server/index.js reads the
// same env var for the static-file route so writes and reads stay in sync.
const CACHE_DIR = process.env.KIMI_CACHE_DIR || join(__dirname, 'tts-cache')

// Sonia (en-GB) — mature, smooth, slightly low-register British female.
// Picked for the "magnetic" character the host should carry. Override with
// the TTS_VOICE env var; alternates worth trying: en-US-AvaNeural (rounder
// US warmth), en-US-MichelleNeural (deeper), en-GB-LibbyNeural.
const DEFAULT_VOICE = process.env.TTS_VOICE || 'en-GB-SoniaNeural'
const DEFAULT_FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3

if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true })
}

function hashFor(voice, text) {
  return createHash('md5').update(`${voice}::${text}`).digest('hex')
}

function streamToFile(stream, path) {
  return new Promise((resolve, reject) => {
    const out = createWriteStream(path)
    stream.on('error', reject)
    out.on('error', reject)
    out.on('finish', resolve)
    stream.pipe(out)
  })
}

// In-flight synthesis registry. Coalesces concurrent requests for the same
// text — without this, a preload + a real speak() racing both see
// existsSync()=false, both spawn MsEdgeTTS, and the second one ends up
// pulling bytes from the first's half-written file (audio plays only the
// first sentence then "ends").
const inFlightSynth = new Map()

/**
 * Synthesize speech to an on-disk mp3, returning the cache URL. Blocks
 * until the entire mp3 is written. Use streamSpeechTo below for realtime
 * playback (avoids the ~1x real-time synthesis wait).
 *
 * Atomicity: writes to a `.tmp` file then renameSync() to the final cache
 * path. existsSync() can never see a partial mp3 — it sees nothing or the
 * fully-written file, never the half-flushed in-between state.
 */
export async function synthesizeSpeech(text, options = {}) {
  const voice = options.voice || DEFAULT_VOICE
  const hash = hashFor(voice, text)
  const cachePath = join(CACHE_DIR, `${hash}.mp3`)
  const tempPath = `${cachePath}.tmp`

  if (existsSync(cachePath)) {
    return `/tts-cache/${hash}.mp3`
  }

  // Reuse the in-flight promise if another request is already synthesizing
  // this exact text. Both callers await the same write + rename.
  if (inFlightSynth.has(hash)) {
    return await inFlightSynth.get(hash)
  }

  const promise = (async () => {
    const tts = new MsEdgeTTS()
    try {
      await tts.setMetadata(voice, DEFAULT_FORMAT)
      const { audioStream } = tts.toStream(text)
      await streamToFile(audioStream, tempPath)
      // Atomic publish — once renameSync returns, existsSync(cachePath)
      // is true AND the file is complete. No window where a reader sees
      // a partial mp3.
      renameSync(tempPath, cachePath)
    } catch (e) {
      // Clean up partial temp on failure so the next attempt re-synthesizes
      // from scratch instead of trusting a corrupted file.
      try { unlinkSync(tempPath) } catch {}
      throw e
    } finally {
      try { tts.close() } catch {}
    }
    return `/tts-cache/${hash}.mp3`
  })()

  inFlightSynth.set(hash, promise)
  try {
    return await promise
  } finally {
    inFlightSynth.delete(hash)
  }
}

/**
 * Pipes TTS audio to the provided writable stream (typically an HTTP
 * response) as it's being synthesized — NO wait for full file. Simultaneously
 * writes a cache file so subsequent requests with the same text are instant.
 *
 * Edge TTS delivers audio at ~1x realtime speed. Without streaming, the
 * client would wait ~N seconds for an N-second clip before hearing anything;
 * with streaming, first chunks hit the browser in a fraction of a second.
 */
export async function streamSpeechTo(text, writable, options = {}) {
  const voice = options.voice || DEFAULT_VOICE
  const hash = hashFor(voice, text)
  const cachePath = join(CACHE_DIR, `${hash}.mp3`)

  // Cached — just pipe the file.
  if (existsSync(cachePath)) {
    return new Promise((resolve, reject) => {
      const rs = createReadStream(cachePath)
      rs.on('end', resolve)
      rs.on('error', reject)
      rs.pipe(writable)
    })
  }

  // Fresh synth — tee chunks to both the client and the cache file.
  const tts = new MsEdgeTTS()
  await tts.setMetadata(voice, DEFAULT_FORMAT)
  const { audioStream } = tts.toStream(text)
  const cacheOut = createWriteStream(cachePath)

  return new Promise((resolve, reject) => {
    let failed = false
    audioStream.on('data', (chunk) => {
      if (failed) return
      try { writable.write(chunk) } catch {}
      try { cacheOut.write(chunk) } catch {}
    })
    audioStream.on('end', () => {
      try { writable.end() } catch {}
      cacheOut.end()
      try { tts.close() } catch {}
      resolve()
    })
    audioStream.on('error', (err) => {
      failed = true
      try { writable.end() } catch {}
      cacheOut.destroy()
      try { if (existsSync(cachePath)) unlinkSync(cachePath) } catch {}
      try { tts.close() } catch {}
      reject(err)
    })
  })
}

export function isTTSConfigured() {
  return true
}
