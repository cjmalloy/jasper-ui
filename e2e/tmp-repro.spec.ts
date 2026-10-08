import { type APIRequestContext, expect, type Page, type Response, test } from '@playwright/test';
import { adminHeaders, clearAll, deleteRef, mod, modRemote, openSidebar, openTextSubmit, pollNotifications } from './setup';

test.describe.serial('Origin Plugin: Account Aliases', () => {
  test.setTimeout(120_000);
  const mainApi = process.env.MAIN_API || 'http://localhost:8081';
  const mainApiProxy = process.env.MAIN_API_PROXY || 'http://web';
  const replUrl = process.env.REPL_URL || 'http://localhost:8082';
  const replApi = process.env.REPL_API || 'http://localhost:8083';
  const replApiProxy = process.env.REPL_API_PROXY || 'http://repl-web';
  const runId = Date.now().toString(36);
  const alice = '/?debug=ADMIN&tag=alice';

  function isRefPost(resp: Response) {
    return resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST' && resp.ok();
  }

  async function headers(request: APIRequestContext) {
    await request.get(`${mainApi}/api/v1/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  async function post(page: Page, user: string, title: string, text: string) {
    await page.goto(replUrl + `/?debug=USER&tag=${user}`);
    await expect(page.locator('.settings .author')).toHaveText(user);
    await openTextSubmit(page, '+user/' + user);
    await page.locator('[name=title]').fill(title);
    await page.locator('.editor textarea').fill(text);
    await page.locator('.editor textarea').blur();
    const submitPromise = page.waitForResponse(isRefPost);
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText(title);
  }

  async function expectPulled(page: Page, title: string) {
    await expect.poll(async () => {
      await page.goto(`/tag/@repl?debug=ADMIN&search=${encodeURIComponent(title)}`, { waitUntil: 'networkidle' });
      return await page.locator('.ref-list .link.remote', { hasText: title }).count();
    }, { timeout: 60_000 }).toBeGreaterThan(0);
  }

  async function expectNotified(page: Page, title: string) {
    await pollNotifications(page, 'alice');
    await page.locator('.settings .notification').click();
    await expect(page.locator('.ref-list .link.remote', { hasText: title })).toBeVisible();
    await page.locator('.tabs a', { hasText: 'all' }).first().click();
    await expectNoNotifications(page);
  }

  async function expectNoNotifications(page: Page) {
    await expect.poll(async () => {
      await page.goto(alice, { waitUntil: 'networkidle' });
      return await page.locator('.settings .notification').isVisible();
    }, { timeout: 30_000 }).toBe(false);
  }

  async function expectNotNotified(page: Page, title: string) {
    await expectPulled(page, title);
    await page.goto(alice, { waitUntil: 'networkidle' });
    await expect(page.locator('.settings .notification')).toBeHidden();
    await page.goto('/inbox/unread?debug=ADMIN&tag=alice', { waitUntil: 'networkidle' });
    await expect(page.locator('.ref-list .link', { hasText: title })).toHaveCount(0);
  }

  async function createOrigin(page: Page, base: string, user: string, url: string, proxy: string, local: string, remote: string, aliases: string[]) {
    await deleteRef(page, url, base);
    await page.goto(base + `/?debug=ADMIN&tag=${user}`);
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('#url').fill(url);
    await page.locator('#url').blur();
    await page.getByText('Next').click();
    await page.locator('[name=title]').fill(`Aliases ${local} ${runId}`);
    await page.locator('.floating-ribbons .plugin_origin_pull').click();
    await page.locator('[name=local]').fill(local);
    if (remote) await page.locator('[name=remote]').fill(remote);
    const field = page.locator('.account-aliases');
    for (const [i, alias] of aliases.entries()) {
      await field.locator('button').first().click();
      await expect(field.locator('.tag-field')).toHaveCount(i + 1);
      const input = field.locator('.tag-field input.grow:not(.preview)').last();
      await input.fill(alias);
      await input.blur();
    }
    await page.locator('.plugins-form details.plugin_origin.advanced summary').click();
    await page.locator('[name=proxy]').fill(proxy);
    await page.locator('[name=proxy]').blur();
    const submitPromise = page.waitForResponse(isRefPost);
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText(`Aliases ${local} ${runId}`);
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'enable' }).first().click();
  }


  async function dm(page: Page, base: string, user: string, to: string, title: string) {
    await page.goto(base + `/submit/dm?debug=USER&tag=${user}&to=${encodeURIComponent(to)}`);
    await expect(page.locator('.settings .author')).toHaveText(user);
    await page.locator('#title').fill(title);
    const submitPromise = page.waitForResponse(isRefPost);
    await page.locator('button', { hasText: 'Send' }).click({ force: true });
    await submitPromise;
  }

  test('setup', async ({ page }) => {
    await clearAll(page);
    await clearAll(page, '', '@repl');
    await clearAll(page, replUrl, '@repl');
    await clearAll(page, replUrl, '@repl.main');
    await mod(page, '#mod-root', '#mod-origin', '#mod-user', '#mod-comment', '#mod-mailbox');
    await modRemote(page, replUrl, '#mod-root', '#mod-origin', '#mod-user', '#mod-comment', '#mod-mailbox');
    await createOrigin(page, '', 'alice', replApi, replApiProxy, '@repl', '@repl', ['+user/charlie']);
  });

  test('dm from repl to charlie', async ({ page }) => {
    const title = `DM charlie ${runId}`;
    await dm(page, replUrl, 'bob', '+user/charlie', title);
    await expectPulled(page, title);
    page.on('request', r => { if (r.url().includes('/api/v1/ref/page')) console.log(decodeURIComponent(r.url())); });
    await page.goto('/inbox/dms?debug=ADMIN&tag=alice', { waitUntil: 'networkidle' });
    console.log(await page.locator('.ref-list').innerText());
    await page.goto('/tag/@repl?debug=ADMIN', { waitUntil: 'networkidle' });
    console.log(await page.locator('.ref-list').innerText());
  });

  test('dm from main to charlie@repl', async ({ page }) => {
    const title = `DM main charlie ${runId}`;
    await dm(page, '', 'bob', '+user/charlie@repl', title);
    page.on('request', r => { if (r.url().includes('/api/v1/ref/page')) console.log(decodeURIComponent(r.url())); });
    await page.goto('/inbox/dms?debug=ADMIN&tag=alice', { waitUntil: 'networkidle' });
    console.log(await page.locator('.ref-list').innerText());
  });
});
