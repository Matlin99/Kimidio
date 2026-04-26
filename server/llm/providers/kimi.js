import axios from 'axios'

const BASE_URL = process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1'
const API_KEY = process.env.KIMI_API_KEY || ''

export const isConfigured = () => !!API_KEY

export async function chat(messages, options = {}) {
  if (!API_KEY) {
    throw new Error('Kimi API Key not configured')
  }

  const response = await axios.post(
    `${BASE_URL}/chat/completions`,
    {
      model: options.model || 'moonshot-v1-8k',
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
