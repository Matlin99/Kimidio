import axios from 'axios'

const KIMI_BASE_URL = process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1'
const KIMI_API_KEY = process.env.KIMI_API_KEY || ''

export async function kimiChat(message, history = [], context = {}) {
  if (!KIMI_API_KEY) {
    return {
      content: "Kimi API Key not configured. Please add your API key in Settings.",
      role: 'assistant'
    }
  }

  const messages = [
    {
      role: 'system',
      content: `You are an AI radio DJ assistant named "Archivist Assistant". You help users discover and enjoy music.

Your personality: knowledgeable, warm, slightly poetic, with a deep love for music history and culture.

When responding about music, be descriptive and evocative. Reference artists, albums, and genres with familiarity.

Recent plays: ${context.recentPlays?.map(p => p.track_title).join(', ') || 'None'}
Current time: ${context.timestamp || new Date().toISOString()}

Keep responses concise but engaging (2-4 sentences).`
    },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ]

  try {
    const response = await axios.post(
      `${KIMI_BASE_URL}/chat/completions`,
      {
        model: 'moonshot-v1-8k',
        messages,
        temperature: 0.7,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${KIMI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    )

    return {
      content: response.data.choices[0].message.content,
      role: 'assistant'
    }
  } catch (error) {
    console.error('Kimi API error:', error.response?.data || error.message)
    return {
      content: "Sorry, I'm having trouble connecting right now. Please check your API key and try again.",
      role: 'assistant'
    }
  }
}
