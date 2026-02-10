import { test, expect, type Page } from '@playwright/test';
import { clearMods, openSidebar } from './setup';

test.describe.serial('Outbox Plugin: Remote Notifications', () => {
  let page: Page;
  const mainApi = process.env.MAIN_API || 'http://localhost:8081';
  const mainApiProxy = process.env.MAIN_API_PROXY || 'http://web';
  const replUrl = process.env.REPL_URL || 'http://localhost:8082';
  const replApi = process.env.REPL_API || 'http://localhost:8083';
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

  test('@main: turn on inbox, outbox and remote origins', async () => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a').getByText('setup').click();

    await page.waitForTimeout(100);
    await page.locator('#mod-comment').waitFor();
    await expect(page.locator('#mod-comment')).not.toBeChecked();
    await page.locator('#mod-comment').check();
    await expect(page.locator('#mod-comment')).toBeChecked();
    await page.locator('#mod-mailbox').waitFor();
    await expect(page.locator('#mod-mailbox')).not.toBeChecked();
    await page.locator('#mod-mailbox').check();
    await expect(page.locator('#mod-mailbox')).toBeChecked();
    await page.locator('#mod-root').waitFor();
    await expect(page.locator('#mod-root')).not.toBeChecked();
    await page.locator('#mod-root').check();
    await expect(page.locator('#mod-root')).toBeChecked();
    await page.locator('#mod-origin').waitFor();
    await expect(page.locator('#mod-origin')).not.toBeChecked();
    await page.locator('#mod-origin').check();
    await expect(page.locator('#mod-origin')).toBeChecked();
    await page.locator('#mod-user').waitFor();
    await expect(page.locator('#mod-user')).not.toBeChecked();
    await page.locator('#mod-user').check();
    await expect(page.locator('#mod-user')).toBeChecked();
    await page.locator('button', { hasText: 'Save' }).click();
    await expect(page.locator('.log')).toContainText('Success');
  });

  test('@main: replicate @repl', async () => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a').getByText('origin').click();
    await openSidebar(page);
    await page.getByText('Submit', { exact: true }).click();
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
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Testing Remote @repl');
    await page.locator('.full-page.ref .actions').getByText('enable').click();
  });

  test('@repl: clear mods', async () => {
    await clearMods(page, replUrl);
  });

  test('@repl: turn on outbox and remote origins', async () => {
    await page.goto(replUrl + '/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a').getByText('setup').click();

    await page.waitForTimeout(100);
    await page.locator('#mod-comment').waitFor();
    await expect(page.locator('#mod-comment')).not.toBeChecked();
    await page.locator('#mod-comment').check();
    await expect(page.locator('#mod-comment')).toBeChecked();
    await page.locator('button', { hasText: 'Save' }).click();
    await expect(page.locator('.log')).toContainText('Success');

    await page.waitForTimeout(100);
    await page.locator('#mod-mailbox').waitFor();
    await expect(page.locator('#mod-mailbox')).not.toBeChecked();
    await page.locator('#mod-mailbox').check();
    await expect(page.locator('#mod-mailbox')).toBeChecked();
    await page.locator('button', { hasText: 'Save' }).click();
    await expect(page.locator('.log')).toContainText('Success');

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

    await page.waitForTimeout(100);
    await page.locator('#mod-user').waitFor();
    await expect(page.locator('#mod-user')).not.toBeChecked();
    await page.locator('#mod-user').check();
    await expect(page.locator('#mod-user')).toBeChecked();
    await page.locator('button', { hasText: 'Save' }).click();
    await expect(page.locator('.log')).toContainText('Success');
  });

  test('@repl: replicate @main', async () => {
    await page.goto(replUrl + '/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a').getByText('origin').click();
    await openSidebar(page);
    await page.getByText('Submit', { exact: true }).click();
    await page.locator('#url').fill(mainApi);
    await page.locator('#url').blur();
    await page.getByText('Next').click();
    await page.waitForTimeout(1000); // First part of text is missing
    await page.locator('.floating-ribbons .plugin_origin_pull').click();
    await page.locator('[name=local]').fill('@main');
    await page.locator('.plugins-form details.plugin_origin.advanced summary').click();
    await page.locator('[name=proxy]').fill(mainApiProxy);
    await page.locator('[name=proxy]').blur();
    await page.locator('[name=title]').fill('Testing Remote @main');
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Testing Remote @main');
    await page.locator('.full-page.ref .actions').getByText('enable').click();
  });

  test('@repl: creates ref', async () => {
    await page.goto(replUrl + '/?debug=USER&tag=bob');
    await openSidebar(page);
    await page.getByText('Submit', { exact: true }).click();
    await page.locator('.tabs a').getByText('text').click();
    await page.locator('[name=title]').fill('Ref from other');
    await page.locator('.editor textarea').fill('Hi +user/alice@repl.main! How\'s it going? You should also see this +user/charlie.');
    await page.locator('.editor textarea').blur();
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Ref from other');
    await page.waitForTimeout(1000);
  });

  test('@repl: local user notified', async () => {
    const notificationsPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref/count'));
    await page.goto(replUrl + '/?debug=USER&tag=charlie');
    await notificationsPromise;
    await page.waitForTimeout(100);
    await page.locator('.settings .notification').click();
    await page.locator('.tabs a').getByText('all').click();
    const ref = page.locator('.ref-list .link:not(.remote)', { hasText: 'Ref from other' }).locator('..').locator('..').locator('..');
    await expect(ref.locator('.user.tag', { hasText: 'bob' })).toBeVisible();
  });

  test('@main: check ref was pulled', async () => {
    const notificationsPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref/count'));
    await page.goto('/?debug=USER&tag=alice');
    await notificationsPromise;
    await page.waitForTimeout(100);
    await page.locator('.settings .notification').click();
    await page.locator('.tabs a').getByText('all').click();
    const ref = page.locator('.ref-list .link.remote', { hasText: 'Ref from other' }).locator('..').locator('..').locator('..');
    await expect(ref.locator('.user.tag', { hasText: 'bob' })).toBeVisible();
  });

  test('@main: reply to remote message', async () => {
    const notificationsPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref/count'));
    await page.goto('/?debug=USER&tag=alice');
    await notificationsPromise;
    await page.waitForTimeout(100);
    await page.locator('.settings .inbox').click();
    await page.locator('.tabs a').getByText('all').click();
    const ref = page.locator('.ref-list .link.remote', { hasText: 'Ref from other' }).locator('..').locator('..').locator('..');
    await ref.locator('.actions').getByText('permalink').click();
    await page.locator('.comment-reply textarea').fill('Doing well, thanks!');
    await page.locator('.comment-reply textarea').blur();
    await page.locator('.comment-reply button', { hasText: 'reply' }).click();
    await page.waitForTimeout(3000);
  });

  test('@repl: check reply was pulled', async () => {
    const notificationsPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref/count'));
    await page.goto(replUrl + '/?debug=ADMIN&tag=bob');
    await notificationsPromise;
    await page.waitForTimeout(100);
    await page.locator('.settings .notification').click();
    await page.locator('.tabs a').getByText('all').click();
    const ref = page.locator('.ref-list .link.remote', { hasText: 'Doing well, thanks!' }).locator('..').locator('..').locator('..');
    await expect(ref.locator('.user.tag', { hasText: 'alice' })).toBeVisible();
  });

  test.skip('@repl: check inbox was converted to outbox', async () => {
    await page.goto(replUrl + '/?debug=ADMIN&tag=charlie');
    const notificationsPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref/count'));
    await page.goto(replUrl + '/?debug=ADMIN&tag=charlie');
    await notificationsPromise;
    await page.waitForTimeout(100);
    await page.locator('.settings .notification').click();
    await page.locator('.tabs a').getByText('all').click();
    const ref = page.locator('.ref-list .link.remote', { hasText: 'Doing well, thanks!' }).locator('..').locator('..').locator('..');
    await expect(ref.locator('.user.tag', { hasText: 'alice' })).toBeVisible();
  });

  test('@main: delete remote @repl', async () => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a').getByText('origin').click();
    await openSidebar(page);
    await page.locator('input[type=search]').fill(replApi);
    await page.locator('input[type=search]').press('Enter');
    const repl = page.locator('.link:not(.remote)', { hasText: '@repl' }).locator('..').locator('..').locator('..');
    await repl.locator('.actions').getByText('delete').click();
    await repl.locator('.actions').getByText('yes').click();
  });

  test('@repl: delete remote @main', async () => {
    await page.goto(replUrl + '/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a').getByText('origin').click();
    await openSidebar(page);
    await page.locator('input[type=search]').fill(mainApi);
    await page.locator('input[type=search]').press('Enter');
    const main = page.locator('.link:not(.remote)', { hasText: '@main' }).locator('..').locator('..').locator('..');
    await main.locator('.actions').getByText('delete').click();
    await main.locator('.actions').getByText('yes').click();
  });
});
