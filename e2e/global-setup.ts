import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8080/?debug=ADMIN');
  await page.waitForLoadState('networkidle', { timeout: 300_000 });
  await page.goto('http://localhost:8082/?debug=ADMIN');
  await page.waitForLoadState('networkidle', { timeout: 300_000 });
  await browser.close();
}
export default globalSetup;
