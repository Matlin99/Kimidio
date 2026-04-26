import axios from 'axios'

const BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
const API_KEY = process.env.OPENAI_API_KEY || ''

export const isConfigured = () => !!API_KEY

export async function chat(messages, options = {}) {
  if (!API_KEY) {
    throw new Error('OpenAI API Key not configured')
  }

  const response = await axios.post(
    `${BASE_URL}/chat/completions`,
    {
      model: options.model || 'gpt-4o-mini',
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 500
    },
    {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: options.timeout || 30000
    }
  )

  return {
    content: response.data.choices[0].message.content,
    usage: response.data.usage
  }
}
