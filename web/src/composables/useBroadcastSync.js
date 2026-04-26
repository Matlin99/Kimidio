// State sync between main and pet windows. Both live at the same origin
// (tauri:// in prod, http://localhost:5175 in dev) so a BroadcastChannel
// works with no setup.
//
// Sync surfaces:
//   - player.queue / currentIndex / isPlaying (one-way: main → pet, since
//     main owns the audio element)
//   - chat.messages (two-way, last-writer-wins by length): both windows
//     can send to the AI DJ; whichever side has more messages is treated
//     as the freshest snapshot. Without this, expanding from pet → main
//     loses every reply the user got while in mini mode.

import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../stores/player.js'
import { useChatStore } from '../stores/chat.js'

const CHANNEL = 'kimi-radio-state'

// Module-level command dispatcher — set by startBroadcastSync('pet').
// Other components import dispatchCmd() to send a control command from
// pet to main without needing a ref to the channel.
let dispatchCmd = () => {}
export function dispatchPetCmd(cmd, payload) { dispatchCmd(cmd, payload) }

// Deep-clone via JSON to strip every Vue reactive proxy, function, and
// non-cloneable artifact before postMessage. structured-clone (what the
// BroadcastChannel uses internally) throws DataCloneError on any of
// those — and that error propagates as Unhandled Promise Rejection,
// crashing whichever Vue effect emitted the broadcast.
function plain(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function snapshotPlayer(player) {
  // Trim track objects to the fields TopPanel + MiniStatusBar actually
  // need — keeps the message under a few KB even with a 30-track queue.
  const queue = player.queue.map(t => ({
    id: t.id,
    source: t.source,
    sourceId: t.sourceId,
    title: t.title,
    artist: t.artist,
    cover: t.cover,
    duration: t.duration
  }))
  return plain({
    queue,
    currentIndex: player.currentIndex,
    isPlaying: player.isPlaying
  })
}

function snapshotChat(chat) {
  // structured.queue holds Pinia-reactive track objects → JSON round-trip
  // strips the proxy. Plain destructure {...m} would leave proxies inside
  // nested fields and trigger DataCloneError.
  return plain(chat.messages)
}

function applyChatSnapshot(chat, incoming) {
  if (!Array.isArray(incoming)) return
  // Last-writer-wins by length: receiving side adopts the longer history.
  // This handles "user typed in pet then expanded to main" (pet has more)
  // AND "user typed in main then collapsed to pet" (main has more).
  if (incoming.length <= chat.messages.length) return
  // Use the store action — direct splice/assign from outside doesn't
  // reliably trigger reactivity through Pinia's ref auto-unwrap proxy.
  chat.setMessages(incoming)
}

export function startBroadcastSync(role) {
  const player = usePlayerStore()
  const chat = useChatStore()
  // storeToRefs gives us actual refs (not auto-unwrapped values) so deep
  // watchers reliably fire on store mutations. Without this layer, watch
  // sources read through Pinia's proxy and can miss updates depending on
  // setup-vs-options-store internals.
  const { messages: chatMessages } = storeToRefs(chat)
  const { queue: playerQueue, currentIndex, isPlaying } = storeToRefs(player)
  const channel = new BroadcastChannel(CHANNEL)

  // Track last-broadcast snapshots so we don't spam the channel with
  // duplicates when reactive sources fire without semantic changes.
  let lastPlayerJson = ''
  let lastChatJson = ''

  const broadcastPlayer = () => {
    const snap = snapshotPlayer(player)
    const j = JSON.stringify(snap)
    if (j === lastPlayerJson) return
    lastPlayerJson = j
    channel.postMessage({ type: 'player', snap })
  }
  const broadcastChat = () => {
    const snap = snapshotChat(chat)
    const j = JSON.stringify(snap)
    if (j === lastChatJson) return
    lastChatJson = j
    console.log(`[bcast/${role}] chat → ${snap.length} msg(s)`)
    channel.postMessage({ type: 'chat', messages: snap })
  }

  // Both windows broadcast chat (two-way sync). Only main broadcasts
  // player state (one-way; pet's queue is read-only).
  watch(chatMessages, broadcastChat, { deep: true, immediate: true })

  if (role === 'main') {
    watch(
      [playerQueue, currentIndex, isPlaying],
      broadcastPlayer,
      { deep: true, immediate: true }
    )
  } else if (role === 'pet') {
    // Mute pet's local audio element — main is the sound source. Without
    // this, setting currentIndex in pet would trigger pet's own play()
    // call and we'd hear the song twice (slightly out of sync).
    if (player.audio) {
      player.audio.muted = true
      player.audio.volume = 0
    }
  }

  channel.onmessage = (e) => {
    const data = e.data
    if (!data) return
    if (data.type === 'request-state') {
      // Forced re-broadcast for newly-mounted peers asking what the
      // current snapshot is.
      lastPlayerJson = ''
      lastChatJson = ''
      if (role === 'main') broadcastPlayer()
      broadcastChat()
      return
    }
    if (data.type === 'player' && role === 'pet') {
      const { queue, currentIndex } = data.snap
      // Replace queue contents in place so reactivity fires on every
      // template that maps over player.queue.
      player.queue.length = 0
      if (Array.isArray(queue)) player.queue.push(...queue)
      player.currentIndex = Math.max(0, Math.min(currentIndex ?? 0, player.queue.length - 1))
      return
    }
    if (data.type === 'chat') {
      const before = chat.messages.length
      applyChatSnapshot(chat, data.messages)
      console.log(`[bcast/${role}] chat ← ${data.messages?.length} msg(s) (had ${before}, now ${chat.messages.length})`)
      return
    }
    // Pet → main commands. Pet's audio is muted, so any user action that
    // would normally trigger playback (clicking a chat track card, hitting
    // play/pause, skipping) has to be forwarded to main where the actual
    // <audio> element lives. Main interprets the cmd and acts.
    if (data.type === 'cmd' && role === 'main') {
      const { cmd, payload } = data
      console.log(`[bcast/main] cmd ← ${cmd}`, payload || '')
      if (cmd === 'play-track' && payload?.id) {
        const idx = player.queue.findIndex(t => t.id === payload.id)
        if (idx >= 0) {
          player.selectTrack(idx)
        } else {
          player.insertNext(payload)
          player.selectTrack(player.currentIndex + 1)
        }
      } else if (cmd === 'toggle-play') {
        player.togglePlay()
      } else if (cmd === 'next') {
        player.nextTrack()
      } else if (cmd === 'prev') {
        player.prevTrack()
      }
      return
    }
  }

  // Expose a command-dispatch helper. Pet calls this for any user action
  // that needs the main window's <audio> element to do real work.
  // No-op if called from main (commands would loop back to itself).
  dispatchCmd = (cmd, payload) => {
    if (role !== 'pet') return
    channel.postMessage({ type: 'cmd', cmd, payload: payload ? plain(payload) : undefined })
  }

  // Newly-mounted peer asks the rest of the network for the latest
  // snapshot. Pet rarely opens before main, but main can also boot
  // after pet (e.g. when the user clicks chevron-back-to-main from a
  // long-running pet session); both directions are covered.
  const ask = () => channel.postMessage({ type: 'request-state' })
  ask()
  setTimeout(ask, 300)
  setTimeout(ask, 1000)
}
