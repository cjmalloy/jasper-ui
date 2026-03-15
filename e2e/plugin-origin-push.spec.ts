import { expect, type Page, test } from '@playwright/test';
import { clearAll, mod, openSidebar } from './setup';

test.describe.serial('Origin Push Plugin', () => {
  const replUrl = process.env.REPL_URL || 'http://localhost:8082';
  const replApiProxy = process.env.REPL_API_PROXY || 'http://repl-web';

  async function pushOrigin(page: Page) {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('input[type=search]').fill(replApiProxy);
    await page.locator('input[type=search]').press('Enter');
    await expect(page.locator('.link:not(.remote)', { hasText: '@repl' }).first()).toBeVisible();
    const repl = page.locator('.ref-list .ref').filter({
      has: page.locator('.link:not(.remote)', { hasText: '@repl' }),
    }).first();
    await repl.locator('.actions .show-more').click();
    await page.locator('.advanced-actions .fake-link', { hasText: 'push' }).first().click();
    await page.locator('.advanced-actions .fake-link', { hasText: 'yes' }).first().click();
  }

  test('@\u{ff20}main : clear all', async ({ page }) => {
    await clearAll(page);
  });

  test('@\u{ff20}repl : clear all', async ({ page }) => {
    await clearAll(page, replUrl);
  });

  test('@\u{ff20}main : turn on push', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-origin');
  });

  test('@\u{ff20}main : creates a remote origin', async ({ page }) => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('#url').fill(replApiProxy);
    await page.locator('#url').blur();
    await page.getByText('Next').click();
    await expect(page.locator('.floating-ribbons .plugin_origin_push')).toBeVisible();
    await page.locator('.floating-ribbons .plugin_origin_push').click();
    await page.locator('[name=remote]').fill('@repl');
    await page.locator('[name=title]').fill('Testing Remote @repl');
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST');
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect.poll(async () => (
      await page.locator('.full-page.ref .link').first().textContent()
    )?.includes('Testing Remote @repl') || false, { timeout: 60_000 }).toBe(true);
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'enable' }).first().click();
    await expect(page.locator('.full-page.ref .actions .fake-link', { hasText: 'disable' }).first()).toBeVisible();
  });

  test('@\u{ff20}main : creates ref', async ({ page }) => {
    await page.goto('/?debug=USER&tag=bob');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('.tabs a', { hasText: 'text' }).first().click();
    await page.locator('[name=title]').fill('Push Test');
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST');
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    await submitPromise;
    await expect.poll(async () => (
      await page.locator('.full-page.ref .link').first().textContent()
    )?.includes('Push Test') || false, { timeout: 60_000 }).toBe(true);
  });

  test('@\u{ff20}main : push pending ref batch', async ({ page }) => {
    test.slow();
    await pushOrigin(page);
  });

  test('@\u{ff20}repl : check ref was pushed', async ({ page }) => {
    test.slow();
    const path = replUrl + '/tag/@repl?debug=ADMIN';
    await expect.poll(async () => {
      await page.goto(path, { waitUntil: 'networkidle' });
      const ref = page.locator('.ref-list .ref').filter({
        has: page.locator('.link', { hasText: 'Push Test' }),
      }).first();
      return await ref.locator('.user.tag', { hasText: 'bob' }).first().isVisible().catch(() => false);
    }, { timeout: 60_000 }).toBe(true);
  });

  test('@\u{ff20}main : delete remote \u{ff20}repl', async ({ page }) => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('input[type=search]').fill(replApiProxy);
    await page.locator('input[type=search]').press('Enter');
    const repl = page.locator('.ref-list .ref').filter({
      has: page.locator('.link:not(.remote)', { hasText: '@repl' }),
    }).first();
    await repl.locator('.actions .fake-link', { hasText: 'delete' }).first().click();
    await repl.locator('.actions .fake-link', { hasText: 'yes' }).first().click();
  });
});
