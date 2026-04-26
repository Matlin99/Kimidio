import * as kimi from './providers/kimi.js'
import * as claude from './providers/claude.js'
import * as openai from './providers/openai.js'
import * as minimax from './providers/minimax.js'
import * as gemini from './providers/gemini.js'
import * as mock from './providers/mock.js'

const realProviders = { kimi, claude, openai, minimax, gemini }

export function getAvailableProviders() {
  return Object.entries(realProviders)
    .filter(([_, p]) => p.isConfigured())
    .map(([name, _]) => name)
}

export function getProviderStatus() {
  const real = Object.entries(realProviders).map(([name, p]) => ({
    name,
    configured: p.isConfigured(),
    defaultModel: name === 'kimi' ? 'moonshot-v1-8k'
      : name === 'claude' ? 'claude-3-5-sonnet-20241022'
      : name === 'minimax' ? 'MiniMax-M2'
      : name === 'gemini' ? 'gemini-2.5-flash'
      : 'gpt-4o-mini'
  }))

  // Add mock provider
  real.push({
    name: 'mock',
    configured: true,
    defaultModel: 'mock-mode',
    isMock: true
  })

  return real
}

export async function chat(providerName, messages, options = {}) {
  const available = getAvailableProviders()

  // If no real providers configured, use mock
  if (available.length === 0 || providerName === 'mock') {
    return mock.chat(messages, options)
  }

  const provider = realProviders[providerName]
  if (!provider) {
    throw new Error(`Unknown LLM provider: ${providerName}`)
  }
  if (!provider.isConfigured()) {
    throw new Error(`Provider ${providerName} is not configured. Please add API key in .env`)
  }
  return provider.chat(messages, options)
}

// Fallback: use first available real provider
export async function chatWithFallback(messages, options = {}) {
  const available = getAvailableProviders()
  if (available.length === 0) {
    return mock.chat(messages, options)
  }
  return chat(available[0], messages, options)
}
