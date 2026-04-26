const { chromium } = require('playwright')
const { writeFileSync } = require('fs')
const { join } = require('path')

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()

  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', e => errs.push('pageerror: ' + e.message))

  await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  // 1. Manifest link present
  const manifestHref = await page.$eval('link[rel="manifest"]', el => el.href).catch(() => null)
  console.log('manifest link:', manifestHref)

  // 2. Fetch the manifest
  const manifest = await page.evaluate(async () => {
    const r = await fetch('/manifest.webmanifest')
    return r.ok ? r.json() : null
  })
  console.log('manifest OK:', !!manifest, manifest?.name, manifest?.display)

  // 3. Service worker registered
  const swOK = await page.evaluate(async () => {
    if (!navigator.serviceWorker) return 'no navigator.serviceWorker'
    const regs = await navigator.serviceWorker.getRegistrations()
    return { count: regs.length, scope: regs[0]?.scope, active: !!regs[0]?.active }
  })
  console.log('service worker:', JSON.stringify(swOK))

  // 4. Theme color meta
  const themeColor = await page.$eval('meta[name="theme-color"]', el => el.content).catch(() => null)
  console.log('theme-color:', themeColor)

  // 5. Title
  console.log('title:', await page.title())

  // 6. UI screenshot — confirm layout unchanged
  writeFileSync(join(__dirname, '..', '..', 'test-pwa-prod.png'), await page.screenshot({ fullPage: false }))
  console.log('screenshot saved')

  // 7. Open chat overlay and screenshot (to see empty state; TTS button only visible on messages with .say)
  const settingsBtn = await page.$('button[title*="Settings" i], button[aria-label*="settings" i]')
  // Simpler: just grab any button that shows ArchivistChat. Fall back to a keyboard shortcut or direct call.
  // Just take the main screenshot; chat UI is already covered by existing screenshot tests.

  console.log('errors on page:', errs.length ? errs : 'none')

  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
