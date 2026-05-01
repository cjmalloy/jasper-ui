import { expect, type Page, type Response, test } from '@playwright/test';
import { clearAll, clearOrigin, mod, openSidebar } from './setup';

test.describe.serial('Origin Push Plugin', () => {
  const replUrl = process.env.REPL_URL || 'http://localhost:8082';
  const replApiProxy = process.env.REPL_API_PROXY || 'http://repl-web';
  const runId = Date.now().toString(36);
  const pushTestTitle = `Push Test ${runId}`;
  const manualPushTestTitle = `Manual Push Test ${runId}`;

  function isRefPost(resp: Response) {
    return resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST' && resp.ok();
  }

  async function createRemoteOrigin(page: Page, title: string, enablePushOnChange: boolean) {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('#url').fill(replApiProxy);
    await expect(page.getByText('Next')).toBeEnabled();
    await page.getByText('Next').click();
    await expect(page.locator('.floating-ribbons .plugin_origin_push')).toBeVisible();
    await page.locator('.floating-ribbons .plugin_origin_push').click();
    if (!enablePushOnChange) {
      await page.locator('[name=pushOnChange]').uncheck();
    }
    await page.locator('[name=remote]').fill('@repl');
    await page.locator('[name=title]').fill(title);
    const submitPromise = page.waitForResponse(isRefPost);
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText(title);
  }

  async function createTextRef(page: Page, title: string) {
    await page.goto('/?debug=USER&tag=bob');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('.tabs a', { hasText: 'text' }).first().click();
    await page.locator('[name=title]').fill(title);
    const submitPromise = page.waitForResponse(isRefPost);
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText(title);
  }

  async function expectPushed(page: Page, title: string) {
    const path = replUrl + '/tag/@repl?debug=ADMIN';
    await expect.poll(async () => {
      await page.goto(path, { waitUntil: 'networkidle' });
      return await page.locator('.ref-list .link', { hasText: title }).count();
    }, { timeout: 60_000 }).toBeGreaterThan(0);
    const ref = page.locator('.ref-list .link', { hasText: title }).locator('..').locator('..').locator('..');
    await expect(ref.locator('.user.tag', { hasText: 'bob' }).first()).toBeVisible();
  }

  async function runManualPush(page: Page) {
    await page.goto(`/ref/e/${encodeURIComponent(replApiProxy)}?debug=ADMIN`);
    await page.locator('.full-page.ref .actions .show-more').click();
    const menu = page.locator('.advanced-actions');
    await menu.locator('.fake-link', { hasText: 'push' }).click();
    await menu.locator('.fake-link', { hasText: 'yes' }).click();
    await expect(menu).toBeHidden();
  }

  test('@\u{ff20}main : clear all', async ({ page }) => {
    await clearAll(page);
  });

  test('@\u{ff20}repl : clear all', async ({ page }) => {
    await clearAll(page, replUrl, '@repl');
  });

  test('@\u{ff20}main : turn on push', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-origin');
  });

  test('@\u{ff20}main : creates a remote origin', async ({ page }) => {
    await createRemoteOrigin(page, 'Testing Remote @repl', true);
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'enable' }).first().click();
  });

  test('@\u{ff20}main : creates ref and pushes on change', async ({ page }) => {
    await clearOrigin(page, replUrl, '@repl');
    await createTextRef(page, pushTestTitle);
    await expectPushed(page, pushTestTitle);
  });

  test('@\u{ff20}main : delete remote \u{ff20}repl', async ({ page }) => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('input[type=search]').fill(replApiProxy);
    await page.locator('input[type=search]').press('Enter');
    const repl = page.locator('.link:not(.remote)', { hasText: '@repl' }).locator('..').locator('..').locator('..');
    await repl.locator('.actions .fake-link', { hasText: 'delete' }).first().click();
    await repl.locator('.actions .fake-link', { hasText: 'yes' }).first().click();
  });

  test('@\u{ff20}main : creates a remote origin without push on change', async ({ page }) => {
    await createRemoteOrigin(page, 'Testing Manual Remote @repl', false);
  });

  test('@\u{ff20}main : creates ref and manually pushes', async ({ page }) => {
    await clearOrigin(page, replUrl, '@repl');
    await createTextRef(page, manualPushTestTitle);
    await runManualPush(page);
    await expectPushed(page, manualPushTestTitle);
  });
});
