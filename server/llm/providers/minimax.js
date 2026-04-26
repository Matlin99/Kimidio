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

  return {
    content: response.data.choices[0].message.content,
    usage: response.data.usage
  }
}
