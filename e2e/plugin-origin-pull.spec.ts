import { expect, type Page, test } from '@playwright/test';
import { clearAll, expectRefAuthor, expectRefPage, mod, openSidebar, refListItem } from './setup';

test.describe.serial('Origin Pull Plugin', () => {
  test.describe.configure({ timeout: 90_000 });
  const replUrl = process.env.REPL_URL || 'http://localhost:8082';
  const replApiProxy = process.env.REPL_API_PROXY || 'http://repl-web';

  async function pullRemoteOrigin(page: Page, apiUrl: string, originTag: string) {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('input[type=search]').fill(apiUrl);
    await page.locator('input[type=search]').press('Enter');
    const repl = refListItem(page, originTag, false);
    await expect(repl).toBeVisible();
    await repl.locator('.actions .show-more').click();
    await page.locator('.advanced-actions .fake-link', { hasText: 'pull' }).first().click();
    await page.locator('.advanced-actions .fake-link', { hasText: 'yes' }).first().click();
  }

  test('@\u{ff20}main : clear all', async ({ page }) => {
    await clearAll(page);
    await clearAll(page,'', '@repl');
  });

  test('@\u{ff20}main : turn on pull', async ({ page }) => {
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
    await expect(page.locator('.floating-ribbons .plugin_origin_pull')).toBeVisible();
    await page.locator('.floating-ribbons .plugin_origin_pull').click();
    await page.locator('[name=local]').fill('@repl');
    await page.locator('[name=remote]').fill('@repl');
    await page.locator('[name=title]').fill('Testing Remote @repl');
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expectRefPage(page, 'Testing Remote @repl');
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'enable' }).first().click();
    await expect(page.locator('.full-page.ref .actions .fake-link', { hasText: 'disable' }).first()).toBeVisible();
  });

  test('@\u{ff20}repl : clear all', async ({ page }) => {
    await clearAll(page, replUrl, '@repl');
  });

  test('@\u{ff20}repl : creates ref on remote', async ({ page }) => {
    await page.goto(replUrl + '/?debug=USER&tag=bob');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('.tabs a', { hasText: 'text' }).first().click();
    await page.locator('[name=title]').fill('Pull Test');
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST');
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expectRefPage(page, 'Pull Test');
  });

  test('@\u{ff20}main : pull pending remote batch', async ({ page }) => {
    await pullRemoteOrigin(page, replApiProxy, '@repl');
  });

  test('@\u{ff20}main : check ref was pulled', async ({ page }) => {
    await expectRefAuthor(page, '/tag/@repl?debug=USER', 'Pull Test', 'bob', true);
  });

  test('@\u{ff20}main : delete remote \u{ff20}repl', async ({ page }) => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('input[type=search]').fill(replApiProxy);
    await page.locator('input[type=search]').press('Enter');
    const repl = refListItem(page, '@repl', false);
    await repl.locator('.actions .fake-link', { hasText: 'delete' }).first().click();
    await repl.locator('.actions .fake-link', { hasText: 'yes' }).first().click();
  });
});
