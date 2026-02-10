import { test, expect, type Page } from '@playwright/test';
import { clearMods, openSidebar } from './setup';

test.describe.serial('Origin Push Plugin', () => {
  const replUrl = process.env.REPL_URL || 'http://localhost:8082';
  const replApiProxy = process.env.REPL_API_PROXY || 'http://repl-web';
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('@\u{ff20}main : clear mods', async () => {
    await clearMods(page);
  });

  test('@\u{ff20}repl : clear mods', async () => {
    await clearMods(page, replUrl);
  });

  test('@\u{ff20}main : turn on push', async () => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'setup' }).first().click();

    await page.waitForTimeout(100);
    await page.locator('#mod-root').waitFor();
    if (!(await page.locator('#mod-root').isChecked())) {
      await page.locator('#mod-root').check();
    }
    await expect(page.locator('#mod-root')).toBeChecked();
    await page.locator('#mod-origin').waitFor();
    if (!(await page.locator('#mod-origin').isChecked())) {
      await page.locator('#mod-origin').check();
    }
    await expect(page.locator('#mod-origin')).toBeChecked();
    await page.locator('button', { hasText: 'Save' }).click();
    await page.locator('.log div', { hasText: 'Success.' }).first().waitFor({ timeout: 15_000, state: 'attached' });
  });

  test('@\u{ff20}main : creates a remote origin', async () => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('#url').pressSequentially(replApiProxy, { delay: 100 });
    await page.getByText('Next').click();
    await page.waitForTimeout(400);
    await page.locator('.floating-ribbons .plugin_origin_push').click();
    await page.locator('[name=remote]').pressSequentially('@repl', { delay: 100 });
    await page.locator('[name=title]').pressSequentially('Testing Remote @repl', { delay: 100 });
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Testing Remote @repl');
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'enable' }).first().click();
  });

  test('@\u{ff20}main : creates ref', async () => {
    await page.goto('/?debug=USER&tag=bob');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('.tabs a', { hasText: 'text' }).first().click();
    await page.waitForTimeout(1000);
    await page.locator('[name=title]').pressSequentially('Push Test', { delay: 100 });
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    await page.waitForTimeout(1000);
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Push Test');
  });

  test('@\u{ff20}repl : check ref was pushed', async () => {
    await page.goto(replUrl + '/tag/@repl?debug=ADMIN');
    const ref = page.locator('.ref-list .link', { hasText: 'Push Test' }).locator('..').locator('..').locator('..');
    await expect(ref.locator('.user.tag', { hasText: 'bob' }).first()).toBeVisible();
  });

  test('@\u{ff20}main : delete remote \u{ff20}repl', async () => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('input[type=search]').pressSequentially(replApiProxy, { delay: 100 });
    await page.locator('input[type=search]').press('Enter');
    const repl = page.locator('.link:not(.remote)', { hasText: '@repl' }).locator('..').locator('..').locator('..');
    await repl.locator('.actions .fake-link', { hasText: 'delete' }).first().click();
    await repl.locator('.actions .fake-link', { hasText: 'yes' }).first().click();
  });
});
