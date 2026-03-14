import { expect, type Page, test } from '@playwright/test';
import { clearAll, expectRefAuthor, expectRefPage, mod, modRemote, openSidebar, pollNotifications, pollRemoteNotifications } from './setup';

test.describe.serial('Outbox Plugin: Remote Notifications', () => {
  test.describe.configure({ timeout: 90_000 });
  const mainApi = process.env.MAIN_API || 'http://localhost:8081';
  const mainApiProxy = process.env.MAIN_API_PROXY || 'http://web';
  const replUrl = process.env.REPL_URL || 'http://localhost:8082';
  const replApi = process.env.REPL_API || 'http://localhost:8083';
  const replApiProxy = process.env.REPL_API_PROXY || 'http://repl-web';

  function refListItem(page: Page, title: string, remote = false) {
    return page.locator('.ref-list .ref', {
      has: page.locator(`.link${remote ? '.remote' : ':not(.remote)'}`, { hasText: title }),
    }).first();
  }

  async function expectInboxRefAuthor(page: Page, base: string, user: string, title: string, author: string, remote = false) {
    await expectRefAuthor(page, `${base}/inbox/all?debug=ADMIN&tag=${user}`, title, author, remote);
  }

  async function pullOrigin(page: Page, base: string, apiUrl: string, title: string) {
    await page.goto(`${base}/?debug=ADMIN`);
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('input[type=search]').fill(apiUrl);
    await page.locator('input[type=search]').press('Enter');
    const remote = refListItem(page, title);
    await expect(remote).toBeVisible();
    await remote.locator('.actions .show-more').click();
    await page.locator('.advanced-actions .fake-link', { hasText: 'pull' }).first().click();
    await page.locator('.advanced-actions .fake-link', { hasText: 'yes' }).first().click();
  }

  test('@\u{ff20}main : clear all', async ({ page }) => {
    await clearAll(page);
    await clearAll(page, '', '@repl');
  });

  test('@\u{ff20}repl : clear all', async ({ page }) => {
    await clearAll(page, replUrl, '@repl');
    await clearAll(page, replUrl, '@repl.main');
  });

  test('@\u{ff20}main : turn on outbox and remote origins', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-origin', '#mod-user', '#mod-comment', '#mod-mailbox');
  });

  test('@\u{ff20}repl : turn on outbox and remote origins', async ({ page }) => {
    await modRemote(page, replUrl, '#mod-root', '#mod-origin', '#mod-user', '#mod-comment', '#mod-mailbox');
  });

  test('@\u{ff20}main : create users', async ({ page }) => {
    await page.goto('/ext/+user/alice?debug=USER&tag=alice', { waitUntil: 'networkidle' });
    await expect(page.locator('button', {hasText: 'Delete'})).toBeVisible();
  });

  test('@\u{ff20}main : replicate \u{ff20}repl', async ({ page }) => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('#url').fill(replApi);
    await page.locator('#url').blur();
    await page.getByText('Next').click();
    await page.locator('[name=title]').fill('Testing Remote @repl');
    await page.locator('.floating-ribbons .plugin_origin_pull').click();
    await page.locator('[name=local]').fill('@repl');
    await page.locator('[name=remote]').fill('@repl');
    await page.locator('.plugins-form details.plugin_origin.advanced summary').click();
    await page.locator('[name=proxy]').fill(replApiProxy);
    await page.locator('[name=proxy]').blur();
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expectRefPage(page, 'Testing Remote @repl');
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'enable' }).first().click();
    await expect(page.locator('.full-page.ref .actions .fake-link', { hasText: 'disable' }).first()).toBeVisible();
  });

  test('@\u{ff20}repl : create users', async ({ page }) => {
    await page.goto(replUrl + '/ext/+user/bob?debug=USER&tag=bob', { waitUntil: 'networkidle' });
    await expect(page.locator('button', {hasText: 'Delete'})).toBeVisible();
    await page.goto(replUrl + '/ext/+user/charlie?debug=ADMIN&tag=charlie', { waitUntil: 'networkidle' });
    await expect(page.locator('button', {hasText: 'Delete'})).toBeVisible();
  });

  test('@\u{ff20}repl : replicate \u{ff20}main', async ({ page }) => {
    await page.goto(replUrl + '/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('#url').fill(mainApi);
    await page.locator('#url').blur();
    await page.getByText('Next').click();
    await page.locator('.floating-ribbons .plugin_origin_pull').click();
    await page.locator('[name=local]').fill('@main');
    await page.locator('.plugins-form details.plugin_origin.advanced summary').click();
    await page.locator('[name=proxy]').fill(mainApiProxy);
    await page.locator('[name=proxy]').blur();
    await page.locator('[name=title]').fill('Testing Remote @main');
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expectRefPage(page, 'Testing Remote @main');
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'enable' }).first().click();
    await expect(page.locator('.full-page.ref .actions .fake-link', { hasText: 'disable' }).first()).toBeVisible();
  });

  test('@\u{ff20}repl : creates ref', async ({ page }) => {
    await page.goto(replUrl + '/?debug=USER&tag=bob');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('.tabs a', { hasText: 'text' }).first().click();
    await page.locator('[name=title]').fill('Ref from other');
    await page.locator('.editor textarea').fill('Hi +user/alice@repl.main! How\'s it going? You should also see this +user/charlie.');
    await page.locator('.editor textarea').blur();
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST');
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    await submitPromise;
    await expectRefPage(page, 'Ref from other');
  });

  test('@\u{ff20}repl : local user notified', async ({ page }) => {
    await pollRemoteNotifications(page, replUrl, 'charlie');
    await expectInboxRefAuthor(page, replUrl, 'charlie', 'Ref from other', 'bob');
  });

  test('@\u{ff20}main : pull pending remote ref batch', async ({ page }) => {
    await pullOrigin(page, '', replApi, '@repl');
  });

  test('@\u{ff20}main : check ref was pulled', async ({ page }) => {
    await pollNotifications(page, 'alice');
    await expectInboxRefAuthor(page, '', 'alice', 'Ref from other', 'bob', true);
  });

  test('@\u{ff20}main : reply to remote message', async ({ page }) => {
    await page.goto('/?debug=USER&tag=alice', { waitUntil: 'networkidle' });
    await page.locator('.settings .inbox').click();
    await page.locator('.tabs a', { hasText: 'all' }).first().click();
    const ref = refListItem(page, 'Ref from other', true);
    await ref.locator('.actions a', { hasText: 'permalink'}).first().click();
    await page.locator('.comment-reply textarea').fill('Doing well, thanks!');
    await page.locator('.comment-reply textarea').blur();
    const replyPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST');
    await page.locator('.comment-reply button', { hasText: 'reply' }).click();
    await replyPromise;
    await page.waitForLoadState('networkidle');
  });

  test('@\u{ff20}repl : pull pending remote reply batch', async ({ page }) => {
    await pullOrigin(page, replUrl, mainApi, '@main');
  });

  test('@\u{ff20}repl : check reply was pulled', async ({ page }) => {
    await pollRemoteNotifications(page, replUrl, 'bob');
    await expectInboxRefAuthor(page, replUrl, 'bob', 'Doing well, thanks!', 'alice', true);
  });

  test('@\u{ff20}repl : check inbox was converted to outbox', async ({ page }) => {
    await pollRemoteNotifications(page, replUrl, 'charlie');
    await expectInboxRefAuthor(page, replUrl, 'charlie', 'Doing well, thanks!', 'alice', true);
  });

  test('@\u{ff20}main : delete remote \u{ff20}repl', async ({ page }) => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('input[type=search]').fill(replApi);
    await page.locator('input[type=search]').press('Enter');
    const repl = refListItem(page, '@repl');
    await repl.locator('.actions .fake-link', { hasText: 'delete' }).first().click();
    await repl.locator('.actions .fake-link', { hasText: 'yes' }).first().click();
  });

  test('@\u{ff20}repl : delete remote \u{ff20}main', async ({ page }) => {
    await page.goto(replUrl + '/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('input[type=search]').fill(mainApi);
    await page.locator('input[type=search]').press('Enter');
    const main = refListItem(page, '@main');
    await main.locator('.actions .fake-link', { hasText: 'delete' }).first().click();
    await main.locator('.actions .fake-link', { hasText: 'yes' }).first().click();
  });
});
