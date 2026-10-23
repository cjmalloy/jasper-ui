import { expect, type Page } from '@playwright/test';
import { mod, openTextSubmit, test } from './setup';

test.describe.serial('Drafts Plugin', () => {
  let page: Page;
  const title = 'Auto Saved Draft ' + Date.now();

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('enable mods', async () => {
    await mod(page, '#mod-drafts');
  });

  test('auto-saves a text post draft', async () => {
    await page.goto('/?debug=USER', { waitUntil: 'networkidle' });
    await openTextSubmit(page, '+user/debug');
    const saved = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && res.request().method() === 'POST' && res.ok());
    await page.locator('[name=title]').fill(title);
    await saved;
  });

  test('shows the draft title in the drafts list', async () => {
    await page.goto('/inbox/ref/plugin/editing?debug=USER', { waitUntil: 'networkidle' });
    await expect(page.locator('.ref .link a', { hasText: title })).toBeVisible();
  });

  test('opens the draft in the text editor', async () => {
    await page.locator('.ref .link a', { hasText: title }).click();
    await expect(page).toHaveURL(/\/submit\/text/);
    await expect(page.locator('[name=title]')).toHaveValue(title);
  });
});
