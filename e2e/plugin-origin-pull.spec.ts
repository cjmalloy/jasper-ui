import { expect, type Page, test } from '@playwright/test';
import { clearAll, mod, openSidebar } from './setup';

test.describe.serial('Origin Pull Plugin', () => {
  const replUrl = process.env.REPL_URL || 'http://localhost:8082';
  const replApiProxy = process.env.REPL_API_PROXY || 'http://repl-web';

  async function createRemoteOrigin(page: Page, title: string, streamUpdates: boolean) {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('#url').fill(replApiProxy);
    await page.waitForTimeout(400);
    await page.getByText('Next').click();
    await page.waitForTimeout(400);
    await page.locator('.floating-ribbons .plugin_origin_pull').click();
    if (!streamUpdates) {
      await page.locator('[name=websocket]').uncheck();
    }
    await page.locator('[name=local]').fill('@repl');
    await page.locator('[name=remote]').fill('@repl');
    await page.locator('[name=title]').fill(title);
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText(title);
  }

  async function createRemoteTextRef(page: Page, title: string) {
    await page.goto(replUrl + '/?debug=USER&tag=bob');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('.tabs a', { hasText: 'text' }).first().click();
    await page.locator('[name=title]').fill(title);
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText(title);
  }

  async function expectPulled(page: Page, title: string) {
    const path = '/tag/@repl?debug=USER';
    await expect.poll(async () => {
      await page.goto(path, { waitUntil: 'networkidle' });
      return await page.locator('.ref-list .link.remote', { hasText: title }).count();
    }, { timeout: 60_000 }).toBeGreaterThan(0);
    const ref = page.locator('.ref-list .link.remote', { hasText: title }).locator('..').locator('..').locator('..');
    await expect(ref.locator('.user.tag', { hasText: 'bob' }).first()).toBeVisible();
  }

  async function runManualPull(page: Page) {
    await page.goto(`/ref/e/${encodeURIComponent(replApiProxy)}?debug=ADMIN`);
    await page.locator('.full-page.ref .actions .show-more').click();
    const menu = page.locator('.advanced-actions');
    await menu.locator('.fake-link', { hasText: 'pull' }).click();
    await menu.locator('.fake-link', { hasText: 'yes' }).click();
    await expect(menu).toBeHidden();
  }

  test('@\u{ff20}main : clear all', async ({ page }) => {
    await clearAll(page);
    await clearAll(page,'', '@repl');
  });

  test('@\u{ff20}main : turn on pull', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-origin');
  });

  test('@\u{ff20}main : creates a remote origin', async ({ page }) => {
    await createRemoteOrigin(page, 'Testing Remote @repl', true);
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'enable' }).first().click();
  });

  test('@\u{ff20}repl : clear all', async ({ page }) => {
    await clearAll(page, replUrl, '@repl');
  });

  test('@\u{ff20}repl : creates ref on remote for streaming pull', async ({ page }) => {
    await createRemoteTextRef(page, 'Pull Test');
  });

  test('@\u{ff20}main : check ref was pulled with streaming updates', async ({ page }) => {
    await expectPulled(page, 'Pull Test');
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

  test('@\u{ff20}main : creates a remote origin without streaming updates', async ({ page }) => {
    await createRemoteOrigin(page, 'Testing Manual Remote @repl', false);
  });

  test('@\u{ff20}repl : creates ref on remote for manual pull', async ({ page }) => {
    await createRemoteTextRef(page, 'Manual Pull Test');
  });

  test('@\u{ff20}main : manually pulls ref', async ({ page }) => {
    await runManualPull(page);
  });

  test('@\u{ff20}main : check ref was manually pulled', async ({ page }) => {
    await expectPulled(page, 'Manual Pull Test');
  });
});
