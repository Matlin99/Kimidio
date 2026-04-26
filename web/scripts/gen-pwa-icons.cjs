const { chromium } = require('playwright')
const { writeFileSync, mkdirSync } = require('fs')
const { join } = require('path')

const OUT = join(__dirname, '..', 'public', 'pwa-icons')
mkdirSync(OUT, { recursive: true })

const BG = '#0a0809'
const STROKE = '#B0666D'
const FILL = '#B0666D'

// SVG adapted from App.vue loading icon. `innerScale` controls icon vs. canvas
// ratio — 0.6 = icon occupies 60% of canvas (safe for maskable).
function makeHtml(size, innerScale = 0.75) {
  const iconSize = Math.round(size * innerScale)
  const offset = (size - iconSize) / 2
  return `<!doctype html><html><body style="margin:0;padding:0;background:${BG};">
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="0" y="0" width="${size}" height="${size}" fill="${BG}"/>
  <g transform="translate(${offset},${offset}) scale(${iconSize / 80})">
    <rect x="10" y="25" width="60" height="40" rx="8" stroke="${STROKE}" stroke-width="3" fill="none"/>
    <line x1="15" y1="20" x2="65" y2="20" stroke="${STROKE}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="30" cy="45" r="8" stroke="${STROKE}" stroke-width="2" fill="none"/>
    <rect x="48" y="38" width="16" height="14" rx="2" fill="${FILL}" opacity="0.6"/>
    <line x1="50" y1="10" x2="55" y2="20" stroke="${STROKE}" stroke-width="2" stroke-linecap="round"/>
  </g>
</svg>
</body></html>`
}

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ deviceScaleFactor: 1 })

  async function shoot(size, innerScale, name) {
    const page = await ctx.newPage()
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(makeHtml(size, innerScale))
    const buf = await page.screenshot({ omitBackground: false, type: 'png', clip: { x: 0, y: 0, width: size, height: size } })
    writeFileSync(join(OUT, name), buf)
    console.log('wrote', name, buf.length, 'bytes')
    await page.close()
  }

  await shoot(192, 0.75, 'pwa-192.png')
  await shoot(512, 0.75, 'pwa-512.png')
  // maskable: icon occupies ~60% to stay inside safe zone
  await shoot(512, 0.6, 'pwa-maskable-512.png')

  // apple-touch-icon (iOS/macOS Safari)
  await shoot(180, 0.78, 'apple-touch-icon.png')

  await browser.close()
})()
