import { expect, type Page } from '@playwright/test';
import { mod, test } from './setup';

test.describe.serial('repro', () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); });
  test.afterAll(async () => { await page.close(); });
  test('enable mods', async () => { await mod(page, '#mod-drafts'); });

  test('flow A: autosave then submit on same page', async () => {
    const url = 'https://www.jasper.example/a-' + Date.now();
    page.on('response', r => { if (r.url().includes('/api/v1/ref') && r.request().method() !== 'GET') console.log('A', r.request().method(), r.status()); });
    await page.goto('/submit/web?debug=USER&url=' + encodeURIComponent(url), { waitUntil: 'networkidle' });
    await page.locator('[name=title]').fill('A title');
    await page.waitForResponse(r => r.url().includes('/api/v1/ref') && ['POST','PATCH'].includes(r.request().method()), { timeout: 10000 });
    await page.locator('[name=title]').fill('A title 2');
    await page.waitForResponse(r => r.url().includes('/api/v1/ref') && ['POST','PATCH'].includes(r.request().method()), { timeout: 10000 });
    await page.locator('[name=title]').fill('A title 3');
    await page.locator('button[type=submit]', { hasText: 'Submit' }).click();
    await page.waitForTimeout(3000);
    console.log('A url', page.url(), await page.locator('.error').allTextContents());
  });

  test('flow B: save for later, then submit page with url', async () => {
    const url = 'https://www.jasper.example/b-' + Date.now();
    await page.goto('/submit/web?debug=USER&url=' + encodeURIComponent(url), { waitUntil: 'networkidle' });
    await page.locator('[name=title]').fill('B title');
    await page.locator('button', { hasText: 'Save for later' }).click();
    await expect(page).toHaveURL(/inbox/);
    await page.goto('/submit?debug=USER', { waitUntil: 'networkidle' });
    await page.locator('#url').fill(url);
    await page.waitForTimeout(2000);
    console.log('B button', await page.locator('button[type=submit]').allTextContents());
    await page.locator('button[type=submit]').click();
    await page.waitForTimeout(2000);
    console.log('B url', page.url());
    await page.locator('button[type=submit]', { hasText: 'Submit' }).click();
    await page.waitForTimeout(3000);
    console.log('B after', page.url(), await page.locator('.error').allTextContents());
  });

  test('flow C: save for later, then open /submit/web?url directly and edit', async () => {
    const url = 'https://www.jasper.example/c-' + Date.now();
    await page.goto('/submit/web?debug=USER&url=' + encodeURIComponent(url), { waitUntil: 'networkidle' });
    await page.locator('[name=title]').fill('C title');
    await page.locator('button', { hasText: 'Save for later' }).click();
    await expect(page).toHaveURL(/inbox/);
    await page.goto('/submit/web?debug=USER&url=' + encodeURIComponent(url), { waitUntil: 'networkidle' });
    await page.locator('[name=title]').fill('C title 2');
    await page.waitForTimeout(6000);
    await page.locator('button[type=submit]', { hasText: 'Submit' }).click();
    await page.waitForTimeout(3000);
    console.log('C after', page.url(), await page.locator('.error').allTextContents());
  });
});
test.describe.serial('repro race', () => {
  test('enable mods', async ({ page }) => { await mod(page, '#mod-drafts'); });
  test('flow D: autosave fires during slow submit', async ({ page }) => {
    const url = 'https://www.jasper.example/d-' + Date.now();
    page.on('response', r => { if (r.url().includes('/api/v1/ref') && r.request().method() !== 'GET') r.text().then(t => console.log('D', r.request().method(), r.status(), t.slice(0,200))); });
    await page.route(u => u.pathname === '/api/v1/ref', async route => {
      if (route.request().method() === 'PUT') await new Promise(r => setTimeout(r, 6000));
      await route.fallback();
    });
    await page.goto('/submit/web?debug=USER&url=' + encodeURIComponent(url), { waitUntil: 'networkidle' });
    await page.locator('[name=title]').fill('D title');
    await page.waitForResponse(r => r.url().includes('/api/v1/ref') && ['POST','PATCH'].includes(r.request().method()), { timeout: 10000 });
    await page.locator('[name=title]').fill('D title 2');
    await page.locator('button[type=submit]', { hasText: 'Submit' }).click();
    await page.waitForTimeout(10000);
    console.log('D after', page.url(), await page.locator('.error').allTextContents());
  });
});
