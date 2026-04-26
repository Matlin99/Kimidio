import axios from 'axios'

const BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat/v1'
const API_KEY = process.env.MINIMAX_API_KEY || ''
const DEFAULT_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2'

export const isConfigured = () => !!API_KEY

export async function chat(messages, options = {}) {
  if (!API_KEY) {
    throw new Error('MiniMax API Key not configured')
  }

  const response = await axios.post(
    `${BASE_URL}/text/chatcompletion_v2`,
    {
      model: options.model || DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 500,
      ...(options.stream ? { stream: true } : {})
    },
    {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: options.timeout || 30000,
      responseType: options.stream ? 'stream' : 'json'
    }
  )

  if (options.stream) {
    return response.data
  }

  // MiniMax wraps every response with a `base_resp` envelope. On
  // success status_code is 0; on auth/model/quota errors they return
  // a 200 with non-zero status_code and NO `choices` array, which is
  // why the old `response.data.choices[0]` lookup blew up with the
  // unhelpful "undefined is not an object" message that the user
  // actually saw in the chat UI.
  const data = response.data || {}
  const base = data.base_resp || {}
  if (base.status_code && base.status_code !== 0) {
    throw new Error(`MiniMax ${base.status_code}: ${base.status_msg || 'unknown error'}`)
  }
  const choice = data.choices?.[0]
  if (!choice?.message) {
    throw new Error(`MiniMax returned no message. body=${JSON.stringify(data).slice(0, 300)}`)
  }
  return {
    content: choice.message.content || '',
    usage: data.usage
  }
}
