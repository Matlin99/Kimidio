import axios from 'axios'

// Google Gemini provider. Speaks a different shape from the OpenAI-style
// providers (kimi/openai/claude/minimax all share that), so the wire-up
// is a little chunkier — separate systemInstruction field, "model" role
// instead of "assistant", parts[].text instead of message.content.
const BASE_URL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'
const API_KEY = process.env.GEMINI_API_KEY || ''
// gemini-2.5-flash gets the most generous free tier (1500 req/day on the
// AI Studio free key) and is more than capable for chat + music recs.
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

export const isConfigured = () => !!API_KEY

// OpenAI-style messages → Gemini's contents+systemInstruction split.
// system messages are coalesced into a single systemInstruction (Gemini
// only honors one); user/assistant become user/model parts arrays.
function toGeminiPayload(messages) {
  const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n')
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
  const payload = { contents }
  if (sys) payload.systemInstruction = { parts: [{ text: sys }] }
  return payload
}

export async function chat(messages, options = {}) {
  if (!API_KEY) {
    throw new Error('Gemini API Key not configured')
  }

  const model = options.model || DEFAULT_MODEL
  const payload = toGeminiPayload(messages)
  payload.generationConfig = {
    temperature: options.temperature ?? 0.7,
    maxOutputTokens: options.maxTokens ?? 500
  }

  const url = `${BASE_URL}/models/${model}:generateContent`
  let response
  try {
    response = await axios.post(url, payload, {
      headers: {
        'x-goog-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: options.timeout || 30000
    })
  } catch (e) {
    // Surface Gemini's own error envelope when the request fails — these
    // hold the actual reason (PERMISSION_DENIED, INVALID_ARGUMENT, model
    // not found, quota exhausted) which is otherwise buried in axios'
    // generic "Request failed with status code 4xx".
    const errBody = e.response?.data?.error
    if (errBody) {
      throw new Error(`Gemini ${errBody.status || e.response.status}: ${errBody.message || 'unknown error'}`)
    }
    throw e
  }

  const data = response.data || {}
  // Gemini sometimes returns a candidate with no content (safety filter
  // hit, MAX_TOKENS with no text yet, etc.). Surface that explicitly so
  // the chat fallback chain can move on to the next provider.
  const candidate = data.candidates?.[0]
  const text = candidate?.content?.parts?.map(p => p.text || '').join('') || ''
  if (!text) {
    const reason = candidate?.finishReason || 'no candidates'
    throw new Error(`Gemini returned empty response (finishReason=${reason})`)
  }
  return {
    content: text,
    usage: data.usageMetadata
      ? {
          prompt_tokens: data.usageMetadata.promptTokenCount,
          completion_tokens: data.usageMetadata.candidatesTokenCount,
          total_tokens: data.usageMetadata.totalTokenCount
        }
      : undefined
  }
}
