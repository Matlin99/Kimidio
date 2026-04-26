import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOCAL_DIR = join(__dirname, '..', 'local')

// Simple scan - just filename-based for now
// ID3 tag parsing can be added later with a library like music-metadata
export async function scan() {
  try {
    const files = readdirSync(LOCAL_DIR)
    return files
      .filter((f) => f.endsWith('.mp3') || f.endsWith('.flac') || f.endsWith('.wav'))
      .map((f, i) => ({
        id: `local:${f}`,
        source: 'local',
        sourceId: f,
        title: f.replace(/\.[^.]+$/, ''),
        artist: 'Local File',
        album: '',
        cover: '',
        duration: 0, // Would need music-metadata to get real duration
        url: `/music/local/${encodeURIComponent(f)}`,
      }))
  } catch (e) {
    return []
  }
}

export async function getUrl(sourceId) {
  return `/music/local/${encodeURIComponent(sourceId)}`
}

export async function getDetail(sourceId) {
  const files = await scan()
  return files.find((f) => f.sourceId === sourceId) || null
}

export async function search(keyword, limit = 10) {
  const files = await scan()
  const lower = keyword.toLowerCase()
  return files
    .filter((f) => f.title.toLowerCase().includes(lower))
    .slice(0, limit)
}
