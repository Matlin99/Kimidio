const { chromium } = require('playwright')
const { writeFileSync } = require('fs')
const { join } = require('path')

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') console.log('ERR:', m.text()) })

  await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500) // wait for playlist init

  // Inject a large queue and set currentIndex to an off-screen index, check if list scrolled
  const result = await page.evaluate(async () => {
    const root = document.querySelector('#app').__vue_app__
    const pinia = root._context.config.globalProperties.$pinia || root.config.globalProperties.$pinia
    const p = pinia._s.get('player')

    // Make a 20-track fake queue
    const tracks = Array.from({ length: 20 }, (_, i) => ({
      id: `fake:${i}`, source: 'fake', sourceId: String(i),
      title: `Track ${i}`, artist: 'Test', album: '', cover: '', duration: 180, url: ''
    }))
    p.queue = tracks
    p.currentIndex = 0
    await new Promise(r => setTimeout(r, 400))

    // Scroll list to top by resetting container scrollTop
    const container = document.querySelector('[class*="bg-primary-dark/30"], [class*="bg-white"]')
    // More reliable: find by max-height style
    const containers = [...document.querySelectorAll('div')].filter(d => d.style.maxHeight === '200px')
    const list = containers[0]
    if (!list) return { error: 'no list container' }

    const before = list.scrollTop
    // Jump currentIndex to 15 (off-screen)
    p.currentIndex = 15
    await new Promise(r => setTimeout(r, 700)) // smooth scroll time
    const after = list.scrollTop

    // Find the active row
    const active = list.querySelector('[class*="bg-primary-rose/10"], [class*="bg-primary-rose/5"]')
    const activeRect = active?.getBoundingClientRect()
    const containerRect = list.getBoundingClientRect()
    const isVisible = activeRect && activeRect.top >= containerRect.top && activeRect.bottom <= containerRect.bottom + 1

    return {
      scrollBefore: before, scrollAfter: after,
      scrolled: after !== before,
      activeVisible: isVisible,
      activeText: active?.innerText?.slice(0, 50)
    }
  })
  console.log('RESULT:', JSON.stringify(result, null, 2))

  writeFileSync(join(__dirname, '..', '..', 'test-tracklist-scroll.png'),
    await page.screenshot({ fullPage: false }))

  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
