import { expect, type Page, type Response } from '@playwright/test';
import { clearAll, deleteRef, mod, modRemote, openSidebar, openTextSubmit, pollNotifications, test } from './setup';

test.describe.serial('Outbox Plugin: Remote Notifications', () => {
  test.setTimeout(90_000);
  const mainApi = process.env.MAIN_API || 'http://localhost:8081';
  const mainApiProxy = process.env.MAIN_API_PROXY || 'http://web';
  const replUrl = process.env.REPL_URL || 'http://localhost:8082';
  const replApi = process.env.REPL_API || 'http://localhost:8083';
  const replApiProxy = process.env.REPL_API_PROXY || 'http://repl-web';
  const runId = Date.now().toString(36);
  const refFromOtherTitle = `Ref from other ${runId}`;
  const replyText = `Doing well, thanks! ${runId}`;
  const secondRemoteTitle = `Second ref from other ${runId}`;
  const localTitle = `Local ref for Alice ${runId}`;

  function isRefPost(resp: Response) {
    return resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST' && resp.ok();
  }

  async function expectInboxRef(page: Page, title: string, base: string, user: string, remote: boolean) {
    const path = base + `/inbox/all?debug=ADMIN&tag=${user}`;
    const link = `.link${remote ? '.remote' : ':not(.remote)'}`;
    const selector = `.ref-list ${link}`;
    await expect.poll(async () => {
      await page.goto(path, { waitUntil: 'networkidle' });
      return await page.locator(selector, { hasText: title }).count();
    }, { timeout: 60_000 }).toBeGreaterThan(0);
    return page.locator('.ref-list .ref', { has: page.locator(`:scope > ${link}`, { hasText: title }) });
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
    await page.goto('/ext/+user/bob?debug=USER&tag=bob', { waitUntil: 'networkidle' });
    await expect(page.locator('button', {hasText: 'Delete'})).toBeVisible();
  });

  test('@\u{ff20}main : replicate \u{ff20}repl', async ({ page }) => {
    await deleteRef(page, replApi);
    await page.goto('/?debug=ADMIN&tag=alice');
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
    const aliases = page.locator('.account-aliases');
    await aliases.locator('button').first().click();
    await aliases.locator('.tag-field input.grow:not(.preview)').fill('+user/charlie');
    await aliases.locator('.tag-field input.grow:not(.preview)').blur();
    await page.locator('.plugins-form details.plugin_origin.advanced summary').click();
    await page.locator('[name=proxy]').fill(replApiProxy);
    await page.locator('[name=proxy]').blur();
    const submitPromise = page.waitForResponse(isRefPost);
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Testing Remote @repl');
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'enable' }).first().click();
  });

  test('@\u{ff20}repl : create users', async ({ page }) => {
    await page.goto(replUrl + '/ext/+user/bob?debug=USER&tag=bob', { waitUntil: 'networkidle' });
    await expect(page.locator('button', {hasText: 'Delete'})).toBeVisible();
    await page.goto(replUrl + '/ext/+user/charlie?debug=ADMIN&tag=charlie', { waitUntil: 'networkidle' });
    await expect(page.locator('button', {hasText: 'Delete'})).toBeVisible();
  });

  test('@\u{ff20}repl : replicate \u{ff20}main', async ({ page }) => {
    await deleteRef(page, mainApi, replUrl);
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
    const submitPromise = page.waitForResponse(isRefPost);
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Testing Remote @main');
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'enable' }).first().click();
  });

  test('@\u{ff20}main : initialize Alice remote cursor', async ({ page }) => {
    await page.goto('/?debug=USER&tag=alice', { waitUntil: 'networkidle' });
    await expect(page.locator('.settings .notification')).toBeHidden();
  });

  test('@\u{ff20}repl : initialize Charlie local cursor', async ({ page }) => {
    await page.goto(replUrl + '/?debug=USER&tag=charlie', { waitUntil: 'networkidle' });
    await expect(page.locator('.settings .notification')).toBeHidden();
  });

  test('@\u{ff20}repl : creates ref', async ({ page }) => {
    await page.goto(replUrl + '/?debug=USER&tag=bob');
    await expect(page.locator('.settings .author')).toHaveText('bob');
    await openTextSubmit(page, '+user/bob');
    await page.locator('[name=title]').fill(refFromOtherTitle);
    await page.locator('.editor textarea').fill('Hi +user/charlie! How\'s it going?');
    await page.locator('.editor textarea').blur();
    const submitPromise = page.waitForResponse(isRefPost);
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText(refFromOtherTitle);
  });

  test('@\u{ff20}repl : local user notified', async ({ page }) => {
    const ref = await expectInboxRef(page, refFromOtherTitle, replUrl, 'charlie', false);
    await expect(ref.locator('.user.tag', { hasText: 'bob' }).first()).toBeVisible();
  });

  test('@\u{ff20}main : check ref was pulled', async ({ page }) => {
    await pollNotifications(page, 'alice');
    await page.locator('.settings .notification').click();
    const unreadRef = page.locator('.ref-list .link.remote', { hasText: refFromOtherTitle });
    await expect(unreadRef).toBeVisible();
    await page.locator('.tabs a', { hasText: 'all' }).first().click();
    const ref = page.locator('.ref-list .link.remote', { hasText: refFromOtherTitle }).locator('..').locator('..').locator('..');
    await expect(ref.locator('.user.tag', { hasText: 'bob' }).first()).toBeVisible();
    await expect(page.locator('.settings .notification')).toBeHidden();
  });

  test('@\u{ff20}main : local bob is different from remote bob', async ({ page }) => {
    await page.goto('/?debug=USER&tag=bob', { waitUntil: 'networkidle' });
    await expect(page.locator('.settings .notification')).toBeHidden();
    await page.goto('/tag/plugin/inbox/user/bob?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('.ref-list .link', { hasText: refFromOtherTitle })).toHaveCount(0);
  });

  test('@\u{ff20}main : reply to remote message', async ({ page }) => {
    await page.goto('/?debug=USER&tag=alice', { waitUntil: 'networkidle' });
    await page.locator('.settings .inbox').click();
    await page.locator('.tabs a', { hasText: 'all' }).first().click();
    const ref = page.locator('.ref-list .ref', { has: page.locator(':scope > .link.remote', { hasText: refFromOtherTitle }) });
    await ref.locator('.actions a', { hasText: 'permalink'}).first().click();
    await page.locator('.comment-reply textarea').fill(replyText);
    await page.locator('.comment-reply textarea').blur();
    const submitPromise = page.waitForResponse(isRefPost);
    await expect(page.locator('.comment-reply-submit')).toBeEnabled();
    await page.locator('.comment-reply-submit').click();
    await submitPromise;
  });

  test('@\u{ff20}repl : check reply was pulled', async ({ page }) => {
    const ref = await expectInboxRef(page, replyText, replUrl, 'bob', true);
    await expect(ref.locator('.user.tag', { hasText: 'alice' }).first()).toBeVisible();
  });

  test('@\u{ff20}repl : check inbox was converted to outbox', async ({ page }) => {
    const ref = await expectInboxRef(page, replyText, replUrl, 'charlie', true);
    await expect(ref.locator('.user.tag', { hasText: 'alice' }).first()).toBeVisible();
  });

  test('@\u{ff20}repl : sends Charlie a second message', async ({ page }) => {
    await page.goto(replUrl + '/?debug=USER&tag=bob');
    await expect(page.locator('.settings .author')).toHaveText('bob');
    await openTextSubmit(page, '+user/bob');
    await page.locator('[name=title]').fill(secondRemoteTitle);
    await page.locator('.editor textarea').fill('Another one, +user/charlie');
    await page.locator('.editor textarea').blur();
    const submitPromise = page.waitForResponse(isRefPost);
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText(secondRemoteTitle);
  });

  test('@\u{ff20}main : bob sends Alice a local message', async ({ page }) => {
    await page.goto('/?debug=USER&tag=bob');
    await expect(page.locator('.settings .author')).toHaveText('bob');
    await openTextSubmit(page, '+user/bob');
    await page.locator('[name=title]').fill(localTitle);
    await page.locator('.editor textarea').fill('Hi +user/alice');
    await page.locator('.editor textarea').blur();
    const submitPromise = page.waitForResponse(isRefPost);
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText(localTitle);
  });

  test('@\u{ff20}main : clearing \u{ff20}repl keeps local notifications', async ({ page }) => {
    await expectInboxRef(page, secondRemoteTitle, '', 'alice', true);
    await page.goto('/inbox/unread?debug=USER&tag=alice', { waitUntil: 'networkidle' });
    await expect(page.locator('.ref-list .link.remote', { hasText: secondRemoteTitle })).toBeVisible();
    await expect(page.locator('.ref-list .link:not(.remote)', { hasText: localTitle })).toBeVisible();
    // Only the older remote message is on the first page, so only @repl is read
    await page.goto('/inbox/unread?debug=USER&tag=alice&pageSize=1', { waitUntil: 'networkidle' });
    await expect(page.locator('.ref-list .link.remote', { hasText: secondRemoteTitle })).toBeVisible();
    await expect(page.locator('.ref-list .link', { hasText: localTitle })).toHaveCount(0);
    await page.locator('.tabs a', { hasText: 'all' }).first().click();
    await expect.poll(async () => {
      await page.goto('/inbox/unread?debug=USER&tag=alice', { waitUntil: 'networkidle' });
      return await page.locator('.ref-list .link.remote', { hasText: secondRemoteTitle }).count();
    }, { timeout: 30_000 }).toBe(0);
    await expect(page.locator('.ref-list .link:not(.remote)', { hasText: localTitle })).toBeVisible();
    await expect(page.locator('.settings .notification')).toBeVisible();
    await page.locator('.tabs a', { hasText: 'all' }).first().click();
    await expect.poll(async () => {
      await page.goto('/?debug=USER&tag=alice', { waitUntil: 'networkidle' });
      return await page.locator('.settings .notification').isVisible();
    }, { timeout: 30_000 }).toBe(false);
  });

  test('@\u{ff20}main : delete remote \u{ff20}repl', async ({ page }) => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('input[type=search]').fill(replApi);
    await page.locator('input[type=search]').press('Enter');
    const repl = page.locator('.ref', { has: page.locator(':scope > .link:not(.remote)', { hasText: '@repl' }) });
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
    const main = page.locator('.ref', { has: page.locator(':scope > .link:not(.remote)', { hasText: '@main' }) });
    await main.locator('.actions .fake-link', { hasText: 'delete' }).first().click();
    await main.locator('.actions .fake-link', { hasText: 'yes' }).first().click();
  });
});
