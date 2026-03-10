import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const baseUrl = process.env.BASE_URL || config.projects[0]?.use?.baseURL?.toString() || 'http://localhost:8080';
  const replUrl = process.env.REPL_URL || 'http://localhost:8082';
  await page.goto(`${baseUrl}/?debug=ADMIN`);
  await page.waitForLoadState('networkidle', { timeout: 300_000 });
  await page.goto(`${replUrl}/?debug=ADMIN`);
  await page.waitForLoadState('networkidle', { timeout: 300_000 });
  await browser.close();
}
export default globalSetup;
