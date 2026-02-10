import { test, expect, type Page } from '@playwright/test';
import { clearMods, openSidebar } from './setup';

test.describe.serial('Wiki Plugin', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('loads the page', async () => {
    await page.goto('/?debug=USER');
    await expect(page.getByText('Powered by Jasper')).toBeVisible({ timeout: 1000 * 60 });
  });

  test('clear mods', async () => {
    await clearMods(page);
  });

  test('creates a wiki', async () => {
    await page.goto('/?debug=USER');
    await openSidebar(page);
    await page.getByText('Submit').click();
    await page.locator('.tabs a').getByText('wiki').click();
    await page.locator('#url').fill('WIKI TEST');
    await page.locator('button', { hasText: 'Next' }).click();
    await page.locator('.editor textarea').fill('Link to [[Other WIKI]].');
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Wiki test');
  });

  test('should rename page for URL', async () => {
    await page.goto('/ref/e/wiki:Wiki_test?debug=USER');
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Wiki test');
  });

  test('should have internal wiki link', async () => {
    await expect(page.locator('a', { hasText: 'Other WIKI' })).toHaveAttribute('href', '/ref/wiki:Other_wiki');
    await expect(page.locator('a', { hasText: 'Other WIKI' })).not.toHaveAttribute('target');
  });

  test('click wiki link', async () => {
    await page.locator('a', { hasText: 'Other WIKI' }).click();
    const url = page.url().replace('/ref/', '/ref/e/') + '?debug=USER';
    await page.goto(url);
    await expect(page.locator('.error-404')).toContainText('Not Found');
    await page.locator('.submit-button', { hasText: 'Submit Wiki' }).click();
    await expect(page.locator('h5')).toContainText('Submit');
    await expect(page.locator('[name=title]')).toHaveValue('Other wiki');
  });

  test('turn on wiki config', async () => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs', { hasText: 'setup' }).click();

    await page.waitForTimeout(100);
    await page.locator('#mod-wiki').waitFor();
    await expect(page.locator('#mod-wiki')).not.toBeChecked();
    await page.locator('#mod-wiki').check();
    await expect(page.locator('#mod-wiki')).toBeChecked();
    await page.locator('button', { hasText: 'Save' }).click();
    await expect(page.locator('.log')).toContainText('Success');
  });

  test('set external wiki', async () => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs', { hasText: 'template' }).click();
    const fileContent = JSON.stringify({ tag: 'config/wiki', config: { prefix: 'https://externalwiki/', external: true }});
    const buffer = Buffer.from(fileContent);
    await page.locator('input.upload').setInputFiles({
      name: 'config.json',
      mimeType: 'application/json',
      buffer,
    });
  });

  test('submit wiki button removed', async () => {
    await page.goto('/?debug=USER');
    await openSidebar(page);
    await page.getByText('Submit').click();
    await expect(page.locator('.tabs')).not.toContainText('wiki');
  });

  test('wiki link opens external', async () => {
    await page.goto('/ref/e/wiki:Wiki_test?debug=USER');
    await expect(page.locator('a', { hasText: 'Other WIKI' })).toHaveAttribute('href', 'https://externalwiki/Other_wiki');
    await expect(page.locator('a', { hasText: 'Other WIKI' })).toHaveAttribute('target', '_blank');
  });

  test('delete wiki', async () => {
    await page.goto('/ref/e/wiki:Wiki_test?debug=USER');
    await page.locator('.full-page.ref .actions').getByText('delete').click();
    await page.locator('.full-page.ref .actions').getByText('yes').click();
  });
});
