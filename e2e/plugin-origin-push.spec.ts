import { test, expect, type Page } from '@playwright/test';
import { clearMods, openSidebar } from './setup';

test.describe.serial('Origin Push Plugin', () => {
  let page: Page;
  const replUrl = process.env.REPL_URL || 'http://localhost:8082';
  const replApiProxy = process.env.REPL_API_PROXY || 'http://repl-web';

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('@main: loads the page', async () => {
    await page.goto('/?debug=ADMIN');
    await expect(page.getByText('Powered by Jasper')).toBeVisible({ timeout: 1000 * 60 });
  });

  test('@main: clear mods', async () => {
    await clearMods(page);
  });

  test('@repl: clear mods', async () => {
    await clearMods(page, replUrl);
  });

  test('@main: turn on push', async () => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs').getByText('setup').click();

    await page.waitForTimeout(100);
    await page.locator('#mod-root').waitFor();
    await expect(page.locator('#mod-root')).not.toBeChecked();
    await page.locator('#mod-root').check();
    await expect(page.locator('#mod-root')).toBeChecked();
    await page.locator('#mod-origin').waitFor();
    await expect(page.locator('#mod-origin')).not.toBeChecked();
    await page.locator('#mod-origin').check();
    await expect(page.locator('#mod-origin')).toBeChecked();
    await page.locator('button', { hasText: 'Save' }).click();
    await expect(page.locator('.log')).toContainText('Success');
  });

  test('@main: creates a remote origin', async () => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs').getByText('origin').click();
    await openSidebar(page);
    await page.getByText('Submit', { exact: true }).click();
    await page.locator('#url').fill(replApiProxy);
    await page.getByText('Next').click();
    await page.waitForTimeout(400);
    await page.locator('.floating-ribbons .plugin_origin_push').click();
    await page.locator('[name=remote]').fill('@repl');
    await page.locator('[name=title]').fill('Testing Remote @repl');
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Testing Remote @repl');
    await page.locator('.full-page.ref .actions').getByText('enable').click();
  });

  test('@main: creates ref', async () => {
    await page.goto('/?debug=USER&tag=bob');
    await openSidebar(page);
    await page.getByText('Submit', { exact: true }).click();
    await page.locator('.tabs a').getByText('text').click();
    await page.waitForTimeout(1000);
    await page.locator('[name=title]').fill('Push Test');
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    await page.waitForTimeout(1000);
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Push Test');
  });

  test('@repl: check ref was pushed', async () => {
    await page.goto(replUrl + '/tag/@repl?debug=ADMIN');
    const ref = page.locator('.ref-list .link', { hasText: 'Push Test' }).locator('..').locator('..').locator('..');
    await expect(ref.locator('.user.tag', { hasText: 'bob' })).toBeVisible();
  });

  test('@main: delete remote @repl', async () => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs').getByText('origin').click();
    await openSidebar(page);
    await page.locator('input[type=search]').fill(replApiProxy);
    await page.locator('input[type=search]').press('Enter');
    const repl = page.locator('.link:not(.remote)', { hasText: '@repl' }).locator('..').locator('..').locator('..');
    await repl.locator('.actions').getByText('delete').click();
    await repl.locator('.actions').getByText('yes').click();
  });
});
