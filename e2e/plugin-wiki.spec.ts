import { expect, test } from '@playwright/test';
import { clearMods, deleteRef, mod, openSidebar } from './setup';

test.describe.serial('Wiki Plugin', () => {

  test('clear mods', async ({ page }) => {
    await clearMods(page);
  });

  test('creates a wiki', async ({ page }) => {
    // Clean up any existing wiki from a previous failed run/retry
    await deleteRef(page, 'wiki:Wiki_test');
    await page.goto('/?debug=USER');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('.tabs a', { hasText: 'wiki' }).first().click();
    await page.locator('#url').fill('WIKI TEST');
    await page.locator('button', { hasText: 'Next' }).click();
    await page.locator('.editor textarea').fill('Link to [[Other WIKI]].');
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Wiki test');
  });

  test('should rename page for URL', async ({ page }) => {
    await page.goto('/ref/e/wiki:Wiki_test?debug=USER');
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Wiki test');
  });

  test('should have internal wiki link', async ({ page }) => {
    await page.goto('/ref/e/wiki:Wiki_test?debug=USER');
    await expect(page.locator('a', { hasText: 'Other WIKI' })).toHaveAttribute('href', '/ref/wiki:Other_wiki');
    await expect(page.locator('a', { hasText: 'Other WIKI' })).not.toHaveAttribute('target');
  });

  test('click wiki link', async ({ page }) => {
    await page.goto('/ref/e/wiki:Wiki_test?debug=USER');
    await page.locator('a', { hasText: 'Other WIKI' }).click();
    const url = page.url().replace('/ref/', '/ref/e/') + '?debug=USER';
    await page.goto(url);
    await expect(page.locator('.error-404').first()).toContainText('Not Found');
    await page.locator('.submit-button', { hasText: 'Submit Wiki' }).click();
    await expect(page.locator('h5')).toContainText('Submit');
    await expect(page.locator('[name=title]')).toHaveValue('Other wiki');
  });

  test('turn on wiki config', async ({ page }) => {
    await mod(page, '#mod-wiki');
  });

  test('set external wiki', async ({ page }) => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'template' }).first().click();
    const fileContent = JSON.stringify({ tag: 'config/wiki', config: { prefix: 'https://externalwiki/', external: true }});
    const buffer = Buffer.from(fileContent);
    await page.locator('input.upload').setInputFiles({
      name: 'config.json',
      mimeType: 'application/json',
      buffer,
    });
  });

  test('submit wiki button removed', async ({ page }) => {
    await page.goto('/?debug=USER');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await expect(page.locator('.tabs')).not.toContainText('wiki');
  });

  test('wiki link opens external', async ({ page }) => {
    await page.goto('/ref/e/wiki:Wiki_test?debug=USER');
    await expect(page.locator('a', { hasText: 'Other WIKI' })).toHaveAttribute('href', 'https://externalwiki/Other_wiki');
    await expect(page.locator('a', { hasText: 'Other WIKI' })).toHaveAttribute('target', '_blank');
  });

  test('delete wiki', async ({ page }) => {
    await page.goto('/ref/e/wiki:Wiki_test?debug=USER');
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'delete' }).first().click();
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'yes' }).first().click();
  });
});
