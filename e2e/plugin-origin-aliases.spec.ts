import { type APIRequestContext, expect, type Page, type Response } from '@playwright/test';
import { adminHeaders, clearAll, deleteRef, mod, modRemote, openSidebar, openTextSubmit, pollNotifications, test } from './setup';

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

  test('@\u{ff20}main : clear all', async ({ page }) => {
    await clearAll(page);
    await clearAll(page, '', '@repl');
  });

  test('@\u{ff20}repl : clear all', async ({ page }) => {
    await clearAll(page, replUrl, '@repl');
    await clearAll(page, replUrl, '@repl.main');
  });

  test('@\u{ff20}main : install mods', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-origin', '#mod-user', '#mod-comment', '#mod-mailbox');
  });

  test('@\u{ff20}repl : install mods', async ({ page }) => {
    await modRemote(page, replUrl, '#mod-root', '#mod-origin', '#mod-user', '#mod-comment', '#mod-mailbox');
  });

  test('@\u{ff20}main : Alice aliases charlie and dave on \u{ff20}repl', async ({ page }) => {
    await createOrigin(page, '', 'alice', replApi, replApiProxy, '@repl', '@repl', ['+user/charlie', '+user/dave']);
  });

  test('@\u{ff20}repl : mallory claims Alice with a one-sided alias', async ({ page }) => {
    await createOrigin(page, replUrl, 'mallory', mainApi, mainApiProxy, '@main', '', ['+user/alice']);
  });

  test('@\u{ff20}main : initialize Alice cursors', async ({ page }) => {
    await page.goto(alice, { waitUntil: 'networkidle' });
    await expect(page.locator('.settings .notification')).toBeHidden();
  });

  test('@\u{ff20}repl : alias charlie notifies Alice', async ({ page }) => {
    const title = `To charlie ${runId}`;
    await post(page, 'bob', title, 'Hi +user/charlie');
    await expectNotified(page, title);
  });

  test('@\u{ff20}repl : alias dave notifies Alice', async ({ page }) => {
    const title = `To dave ${runId}`;
    await post(page, 'bob', title, 'Hi +user/dave');
    await expectNotified(page, title);
  });

  test('@\u{ff20}repl : child of an alias notifies Alice', async ({ page }) => {
    const title = `To charlie phone ${runId}`;
    await post(page, 'bob', title, 'Hi +user/charlie/phone');
    await expectNotified(page, title);
  });

  test('@\u{ff20}repl : similar user name does not notify Alice', async ({ page }) => {
    const title = `To charlotte ${runId}`;
    await post(page, 'bob', title, 'Hi +user/charlotte');
    await expectNotNotified(page, title);
  });

  test('@\u{ff20}repl : posts by an alias do not notify Alice', async ({ page }) => {
    const title = `From charlie ${runId}`;
    await post(page, 'charlie', title, 'Note to +user/dave');
    await expectNotNotified(page, title);
  });

  test('@\u{ff20}repl : one-sided claim mailbox does not notify Alice', async ({ page }) => {
    const title = `To mallory ${runId}`;
    await post(page, 'bob', title, 'Hi +user/mallory');
    await expectNotNotified(page, title);
  });

  test('@\u{ff20}repl : one-sided claim author is not Alice', async ({ page }) => {
    const title = `From mallory ${runId}`;
    await post(page, 'mallory', title, 'Hi +user/charlie');
    await expectNotified(page, title);
  });

  test('@\u{ff20}main : remove alias dave', async ({ request }) => {
    const params = { url: replApi, origin: '' };
    const res = await request.get(`${mainApi}/api/v1/ref`, { headers: await headers(request), params });
    expect(res.ok()).toBeTruthy();
    const ref = await res.json();
    expect(ref.plugins['+plugin/origin'].aliases).toEqual(['+user/charlie', '+user/dave']);
    const patch = await request.patch(`${mainApi}/api/v1/ref`, {
      headers: { ...await headers(request), 'Content-Type': 'application/merge-patch+json' },
      params: { ...params, cursor: ref.modified },
      data: { plugins: { '+plugin/origin': { aliases: ['+user/charlie'] } } },
    });
    expect(patch.ok(), await patch.text()).toBeTruthy();
  });

  test('@\u{ff20}repl : removed alias does not notify Alice', async ({ page }) => {
    const title = `To dave again ${runId}`;
    await post(page, 'bob', title, 'Hi again +user/dave');
    await expectNotNotified(page, title);
  });

  test('@\u{ff20}main : cleared cursors are saved', async ({ page }) => {
    const title = `Last to charlie ${runId}`;
    await post(page, 'bob', title, 'Bye +user/charlie');
    await pollNotifications(page, 'alice');
    await page.goto('/inbox/unread?debug=ADMIN&tag=alice', { waitUntil: 'networkidle' });
    await expect(page.locator('.ref-list .link.remote', { hasText: title })).toBeVisible();
    await page.locator('.tabs a', { hasText: 'all' }).first().click();
    await expectNoNotifications(page);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.settings .notification')).toBeHidden();
  });

  test('@\u{ff20}main : delete remote \u{ff20}repl', async ({ page }) => {
    await deleteRef(page, replApi);
  });

  test('@\u{ff20}repl : delete remote \u{ff20}main', async ({ page }) => {
    await deleteRef(page, mainApi, replUrl);
  });
});
