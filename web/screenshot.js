const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 }
  });
  
  await page.goto('http://localhost:5175/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: '../screenshot-light.png', fullPage: false });
  
  const dkButton = await page.locator('button:has-text("DK")');
  if (dkButton) await dkButton.click();
  await page.waitForTimeout(800);
  
  await page.screenshot({ path: '../screenshot-dark.png', fullPage: false });
  
  await browser.close();
  console.log('Screenshots saved!');
})();
