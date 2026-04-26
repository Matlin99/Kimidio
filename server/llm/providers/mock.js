export const isConfigured = () => true

const MOCK_REPLIES = [
  {
    keywords: ['hi', 'hello', 'hey', '你好'],
    text: 'Hey there! Welcome to the Kimi Radio lounge. I\'m your AI DJ tonight. What kind of vibe are you looking for? Something chill, upbeat, or maybe a trip down memory lane?',
    structured: null
  },
  {
    keywords: ['recommend', '推薦', '推', 'song', '歌', 'play', 'music'],
    text: 'Great taste! Based on the current mood, I\'d suggest something smooth. Here\'s a pick for you:',
    structured: {
      say: 'Great taste! Based on the current mood, I\'d suggest something smooth.',
      play: ['Feather (feat. Cise Starr & Akin)'],
      reason: 'This track has that perfect late-night jazz-hop energy with warm piano samples and laid-back drums.'
    }
  },
  {
    keywords: ['nujabes', 'modal', 'soul', 'jazz'],
    text: 'Ah, a Nujabes fan! You can\'t go wrong with Modal Soul. The way he blends jazz samples with hip-hop beats is pure magic. Want me to queue up something from that era?',
    structured: {
      say: 'Ah, a Nujabes fan! You can\'t go wrong with Modal Soul.',
      play: ['Luv(sic) pt3 (feat. Shing02)', 'Aruarian Dance'],
      reason: 'Nujabes\' signature sound: melancholic piano, subtle vinyl crackle, and drums that breathe.'
    }
  },
  {
    keywords: ['chill', 'relax', 'calm', 'sleep', '放鬆'],
    text: 'I feel you. Let\'s slow things down. I\'m thinking something with soft textures, maybe a hint of rain sounds or vinyl warmth. Just close your eyes and drift.',
    structured: {
      say: 'Let\'s slow things down with something warm and atmospheric.',
      play: ['Aruarian Dance'],
      reason: 'Minimal percussion, warm guitar loops, and that nostalgic Nujabes atmosphere.'
    }
  },
  {
    keywords: ['focus', 'work', 'study', 'concentrate', '專注'],
    text: 'Focus mode activated. I\'ll keep the vocals minimal and the beats steady. Think instrumental jazz-hop around 85-95 BPM — enough groove to keep you awake, not enough to distract.',
    structured: {
      say: 'Focus mode activated. Instrumental jazz-hop with steady BPM.',
      play: ['Electric Relaxation', 'Mass Appeal'],
      reason: 'Steady mid-tempo beats, minimal vocals, and that head-nodding groove for deep work.'
    }
  },
  {
    keywords: ['upbeat', 'energy', 'happy', 'morning', '晨'],
    text: 'Rise and shine! Let\'s start the day with something that has a little bounce. Horns, funky basslines, maybe some feel-good samples. You got this!',
    structured: {
      say: 'Rise and shine! Something with bounce and feel-good energy.',
      play: ['Rebirth of Slick (Cool Like Dat)'],
      reason: 'Funky basslines, jazz flute samples, and that undeniable 90s optimism.'
    }
  }
]

const FALLBACK_REPLY = {
  text: 'That\'s interesting! I\'m always learning about new music. Tell me more — what artists have been on your rotation lately? Or should I surprise you with something from the crates?',
  structured: null
}

export async function chat(messages, options = {}) {
  // Simulate network delay
  const delay = options.delay ?? (800 + Math.random() * 1200)
  await new Promise(r => setTimeout(r, delay))

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  const content = lastUserMsg?.content?.toLowerCase() || ''

  const match = MOCK_REPLIES.find(r => r.keywords.some(k => content.includes(k)))
  const reply = match || FALLBACK_REPLY

  return {
    content: reply.text,
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    structured: reply.structured,
    _mock: true
  }
}
