import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const baseURL = process.env.BASE_URL || config.projects[0]?.use?.baseURL?.toString() || 'http://localhost:8080';
  const replURL = process.env.REPL_URL || baseURL.replace(':8080', ':8082');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(baseURL + '/?debug=ADMIN');
  await page.waitForLoadState('networkidle', { timeout: 300_000 });
  await page.goto(replURL + '/?debug=ADMIN');
  await page.waitForLoadState('networkidle', { timeout: 300_000 });
  await browser.close();
}
export default globalSetup;
