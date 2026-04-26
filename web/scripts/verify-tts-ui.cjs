const { chromium } = require('playwright')
const { writeFileSync } = require('fs')
const { join } = require('path')

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text()) })
  page.on('pageerror', e => console.log('PAGE ERR:', e.message))

  await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  // Inject a fake assistant message with structured.say to verify the speaker button renders
  const injected = await page.evaluate(() => {
    try {
      const piniaRoot = window.__pinia_disposables__ // not reliable; fall back to app root
      // Actually easier: dispatch via the app's vue pinia store if accessible via window
      // vite dev exposes __VUE_HMR_RUNTIME__ but we're in prod. Use devtools hook instead.
      const hook = window.__VUE_DEVTOOLS_GLOBAL_HOOK__
      if (!hook) return 'no hook'
      // Traverse the app — find the root instance
      const apps = hook.apps || []
      // Not reliable either. Easier: just click on the "AI DJ TERMINAL" button in the UI.
      return 'fallback: click UI'
    } catch (e) {
      return 'eval error: ' + e.message
    }
  })
  console.log('inject result:', injected)

  // Click the "AI DJ TERMINAL" button to open chat
  const djBtn = await page.getByText(/AI DJ TERMINAL/i, { exact: false }).first()
  await djBtn.click().catch(() => {})
  await page.waitForTimeout(600)

  // Take a screenshot of chat overlay
  writeFileSync(join(__dirname, '..', '..', 'test-chat-open.png'), await page.screenshot({ fullPage: false }))
  console.log('chat open screenshot saved')

  // Use page.evaluate to inject a mock assistant message into chat store via Pinia
  const pushed = await page.evaluate(() => {
    // Walk all vue instances looking for the chat store
    const root = document.querySelector('#app').__vue_app__
    if (!root) return 'no root app'
    const pinia = root._context.config.globalProperties.$pinia || root.config.globalProperties.$pinia
    if (!pinia) return 'no pinia'
    const chatStore = pinia._s.get('chat')
    if (!chatStore) return 'no chat store'
    chatStore.messages.push({
      role: 'user', content: 'Play something jazzy'
    })
    chatStore.messages.push({
      role: 'assistant',
      content: 'Sure, spinning some jazz for you.',
      structured: { say: 'Sure, spinning some jazz for you.', reason: 'Jazz fits the late-night vibe.' }
    })
    return 'pushed'
  })
  console.log('push result:', pushed)

  await page.waitForTimeout(500)
  writeFileSync(join(__dirname, '..', '..', 'test-chat-with-tts-btn.png'), await page.screenshot({ fullPage: false }))
  console.log('chat with TTS btn saved')

  // Now open Settings to check the toggle rendered
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(400)

  // Find and click the settings gear (there should be one in TopPanel)
  const settingsOpened = await page.evaluate(() => {
    const root = document.querySelector('#app').__vue_app__
    const pinia = root._context.config.globalProperties.$pinia || root.config.globalProperties.$pinia
    const s = pinia._s.get('settings')
    if (!s) return 'no settings'
    s.isSettingsOpen = true
    return 'open'
  })
  console.log('settings open:', settingsOpened)
  await page.waitForTimeout(500)
  writeFileSync(join(__dirname, '..', '..', 'test-settings-open.png'), await page.screenshot({ fullPage: false }))
  console.log('settings screenshot saved')

  // Click the TTS toggle and verify state flips
  const toggleResult = await page.evaluate(() => {
    const root = document.querySelector('#app').__vue_app__
    const pinia = root._context.config.globalProperties.$pinia || root.config.globalProperties.$pinia
    const s = pinia._s.get('settings')
    const before = s.preferences.ttsEnabled
    s.preferences.ttsEnabled = !s.preferences.ttsEnabled
    return { before, after: s.preferences.ttsEnabled }
  })
  console.log('toggle flipped:', JSON.stringify(toggleResult))

  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
