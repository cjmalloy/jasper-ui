import { type APIRequestContext, expect, type Page, type Response } from '@playwright/test';
import {
  clearFixedOrigins,
  deleteRef,
  isolatedOrigin,
  mod,
  openSidebar,
  openTextSubmit,
  subscribeMain,
  waitForCronToggleResponse,
  waitForUserActionResponse,
  test,
} from './setup';

test.describe.serial('Origin Push Plugin', () => {
  test.setTimeout(90_000);
  const replApiProxy = process.env.REPL_API_PROXY || 'http://repl-web';
  const runId = Date.now().toString(36);
  const pushTestTitle = `Push Test ${runId}`;
  const manualPushTestTitle = `Manual Push Test ${runId}`;
  const replApi = process.env.REPL_API || 'http://localhost:8083';
  // The replica only accepts pushes into the requester's local origin, and the server doesn't send a
  // Local-Origin header when pushing, so this is the one spec that writes to the replica's default origin.
  // Titles are unique per run and nothing else reads @repl itself.
  const remote = '@repl';
  let origin = '';

  test.beforeAll(({}, info) => {
    origin = isolatedOrigin(info);
  });

  function isRefPost(resp: Response) {
    return resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST' && resp.ok();
  }

  async function createRemoteOrigin(page: Page, title: string, enablePushOnChange: boolean) {
    await deleteRef(page, replApiProxy);
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
    await page.locator('[name=remote]').fill(remote);
    await page.locator('[name=title]').fill(title);
    const submitPromise = page.waitForResponse(isRefPost);
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText(title);
  }

  async function createTextRef(page: Page, title: string) {
    await page.goto('/?debug=USER&tag=bob');
    await openTextSubmit(page, '+user/bob');
    await page.locator('[name=title]').fill(title);
    const submitPromise = page.waitForResponse(isRefPost);
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText(title);
  }

  async function expectPushed(request: APIRequestContext, title: string) {
    await expect.poll(async () => {
      const res = await request.get(replApi + '/api/v1/ref/page', {
        headers: { 'Local-Origin': 'default' },
        params: { query: remote, search: title },
      });
      const page = await res.json();
      return page.content.find((ref: any) => ref.title === title)?.tags || [];
    }, { timeout: 60_000 }).toContain('+user/bob');
  }

  async function runManualPush(page: Page) {
    await page.goto(`/ref/e/${encodeURIComponent(replApiProxy)}?debug=ADMIN`);
    await page.locator('.full-page.ref .actions .show-more').click();
    const menu = page.locator('.advanced-actions');
    await menu.locator('.fake-link', { hasText: 'push' }).click();
    const actionResponsePromise = waitForUserActionResponse(page);
    await menu.locator('.fake-link', { hasText: 'yes' }).click();
    await actionResponsePromise;
    await expect(menu).toBeHidden();
  }

  test('clear previous runs', async ({ page }) => {
    await clearFixedOrigins(page);
  });

  test('@\u{ff20}main : turn on push', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-origin');
  });

  test('@\u{ff20}main : creates a remote origin', async ({ page }) => {
    await createRemoteOrigin(page, 'Testing Remote @repl', true);
    const enablePromise = waitForCronToggleResponse(page);
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'enable' }).first().click();
    await enablePromise;
    await expect(page.locator('.full-page.ref .actions .fake-link', { hasText: 'disable' }).first()).toBeVisible();
  });

  test('@\u{ff20}main : creates ref and pushes on change', async ({ page, request }) => {
    const cursor = await subscribeMain('/topic/cursor/' + origin);
    try {
      await test.step('create source ref', async () => {
        await createTextRef(page, pushTestTitle);
        await cursor.message;
      });
    } finally {
      await cursor.close();
    }
    await test.step('expect pushed ref', async () => {
      await expectPushed(request, pushTestTitle);
    });
  });

  test('@\u{ff20}main : delete remote \u{ff20}repl', async ({ page }) => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('input[type=search]').fill(replApiProxy);
    await page.locator('input[type=search]').press('Enter');
    const repl = page.locator('.ref', { has: page.locator(':scope > .link:not(.remote)', { hasText: '@repl' }) });
    await repl.locator('.actions .fake-link', { hasText: 'delete' }).first().click();
    await repl.locator('.actions .fake-link', { hasText: 'yes' }).first().click();
  });

  test('@\u{ff20}main : creates a remote origin without push on change', async ({ page }) => {
    await createRemoteOrigin(page, 'Testing Manual Remote @repl', false);
  });

  test('@\u{ff20}main : creates ref and manually pushes', async ({ page, request }) => {
    await test.step('create source ref', async () => {
      await createTextRef(page, manualPushTestTitle);
    });
    await test.step('run manual push', async () => {
      await runManualPush(page);
    });
    await test.step('expect pushed ref', async () => {
      await expectPushed(request, manualPushTestTitle);
    });
  });
});
