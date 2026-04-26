import axios from 'axios'

const BASE_URL = process.env.CLAUDE_BASE_URL || 'https://api.anthropic.com/v1'
const API_KEY = process.env.CLAUDE_API_KEY || ''

export const isConfigured = () => !!API_KEY

export async function chat(messages, options = {}) {
  if (!API_KEY) {
    throw new Error('Claude API Key not configured')
  }

  // Convert OpenAI format to Anthropic format
  const systemMsg = messages.find(m => m.role === 'system')
  const conversation = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }))

  const response = await axios.post(
    `${BASE_URL}/messages`,
    {
      model: options.model || 'claude-3-5-sonnet-20241022',
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
      system: systemMsg?.content || '',
      messages: conversation
    },
    {
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      timeout: options.timeout || 30000
    }
  )

  return {
    content: response.data.content[0].text,
    usage: response.data.usage
  }
}
