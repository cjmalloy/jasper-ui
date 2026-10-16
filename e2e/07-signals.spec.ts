import { expect, type Page } from '@playwright/test';
import { clearMods, closeSidebar, mod, openSidebar, openTextSubmit, pollNotifications, test } from './setup';

const title = 'Signals Sanity';
const listUrl = `/tag/@*?search=${encodeURIComponent(title)}&debug=ADMIN`;

test.describe.serial('Signal and Event Bus Sanity', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  const row = () => page.locator('.ref-list .ref', { has: page.locator('.link a', { hasText: title }) }).first();

  test('enable mods', async () => {
    await mod(page, '#mod-root', '#mod-user', '#mod-mailbox');
  });

  test('creates a ref', async () => {
    await page.goto(listUrl, { waitUntil: 'networkidle' });
    for (let i = 0; i < 5; i++) {
      const del = page.locator('.ref-list .ref .actions .fake-link', { hasText: 'delete' }).first();
      if (!(await del.isVisible({ timeout: 2_000 }).catch(() => false))) break;
      await del.click();
      await page.locator('.ref-list .ref .actions .fake-link', { hasText: 'yes' }).first().click();
      await page.waitForTimeout(500);
      await page.reload();
    }
    await page.goto('/?debug=ADMIN');
    await openTextSubmit(page, '+user/debug');
    await page.locator('[name=title]').fill(title);
    await page.locator('.editor textarea').fill('Signals comment');
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    await expect(page.locator('.full-page.ref .link a')).toHaveText(title);
  });

  test('store.hotkey: holding Control shows hotkey options', async () => {
    await page.goto('/submit/text?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('.add-more')).toHaveCount(0);
    await page.keyboard.down('Control');
    await expect(page.locator('body')).toHaveClass(/\bhotkey\b/);
    await expect(page.locator('.add-more')).toBeVisible();
    await page.keyboard.up('Control');
    await expect(page.locator('body')).not.toHaveClass(/\bhotkey\b/);
    await expect(page.locator('.add-more')).toHaveCount(0);
  });

  test('store.theme: light toggle switches theme', async () => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    const dark = await page.locator('body').evaluate(el => el.classList.contains('dark-theme'));
    await page.locator('.light-toggle').click();
    await expect(page.locator('body')).toHaveClass(dark ? /\blight-theme\b/ : /\bdark-theme\b/);
    await expect(page.locator('.light-toggle .moon')).toHaveClass(dark ? /\blights-on\b/ : /\blights-off\b/);
    await page.locator('.light-toggle').click();
    await expect(page.locator('body')).toHaveClass(dark ? /\bdark-theme\b/ : /\blight-theme\b/);
    await expect(page.locator('.light-toggle .moon')).toHaveClass(dark ? /\blights-off\b/ : /\blights-on\b/);
    await page.evaluate(() => localStorage.removeItem('theme'));
  });

  test('store.offline: offline event shows banner', async () => {
    await expect(page.locator('.offline-banner')).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.locator('.offline-banner')).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.locator('.offline-banner')).toHaveCount(0);
  });

  test('local store: sidebar toggle', async () => {
    await openSidebar(page);
    await expect(page.locator('.sidebar')).toHaveClass(/\bexpanded\b/);
    await closeSidebar(page);
    await expect(page.locator('.sidebar')).not.toHaveClass(/\bexpanded\b/);
  });

  test('view store: search updates the query and list', async () => {
    await page.goto('/tag/@*?debug=ADMIN', { waitUntil: 'networkidle' });
    const search = page.locator('.search input[type=search]');
    await search.fill(title);
    await search.press('Enter');
    await expect(page).toHaveURL(/search=Signals/);
    await expect(search).toHaveValue(title);
    await expect(row()).toBeVisible();
    await expect(page.locator('.ref-list .ref .link a')).toHaveText([title]);
  });

  test('ref: toggle expands the row', async () => {
    await expect(row().locator('.toggle-plus')).toBeVisible();
    await row().locator('.toggle').first().click();
    await expect(row()).toContainText('Signals comment');
    await row().locator('.toggle').first().click();
    await expect(row()).not.toContainText('Signals comment');
  });

  test('event bus: toggle-all-open / toggle-all-closed', async () => {
    await openSidebar(page);
    await page.locator('.sidebar .advanced summary', { hasText: 'Bulk tools' }).click();
    await page.locator('.sidebar .advanced .fake-link', { hasText: 'toggle' }).click();
    await expect(row()).toContainText('Signals comment');
    await page.locator('.sidebar .advanced .fake-link', { hasText: 'toggle' }).click();
    await expect(row()).not.toContainText('Signals comment');
    await closeSidebar(page);
  });

  test('event bus: reload then refresh after tagging', async () => {
    await row().locator('.actions .fake-link', { hasText: 'tag' }).first().click();
    const reload = page.waitForResponse(resp => (
      resp.url().includes('/api/v1/ref?') && resp.request().method() === 'GET' && resp.ok()
    ));
    await row().locator('.inline-tagging input').fill('signals');
    await row().locator('.inline-tagging input').press('Enter');
    await reload;
    await expect(row().locator('.tag', { hasText: 'signals' })).toBeVisible();
  });

  test('event bus: error shows on the row', async () => {
    await page.route('**/api/v1/tags?**', route => route.request().method() === 'POST'
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Signals error"}' })
      : route.continue());
    try {
      await expect(row().locator('.error')).toHaveCount(0);
      await row().locator('.actions .fake-link', { hasText: 'tag' }).first().click();
      await row().locator('.inline-tagging input').fill('broken');
      await row().locator('.inline-tagging input').press('Enter');
      await expect(row().locator('.error').first()).toBeVisible();
      await expect(row().locator('.tag', { hasText: 'broken' })).toHaveCount(0);
    } finally {
      await page.unrouteAll();
    }
  });

  test('event bus: reload after reply', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await row().locator('.actions .fake-link', { hasText: 'reply' }).first().click();
    await row().locator('.comment-reply textarea').fill('Signals reply');
    const reload = page.waitForResponse(resp => (
      resp.url().includes('/api/v1/ref?') && resp.request().method() === 'GET' && resp.ok()
    ));
    await row().locator('button', { hasText: 'reply' }).click();
    await reload;
    await expect(row().locator('.comment-reply')).toHaveCount(0);
    await expect(row().locator('.actions a', { hasText: '1 citation' })).toBeVisible();
  });

  test('account: inbox notification', async () => {
    await page.goto('/?debug=ADMIN&tag=alice', { waitUntil: 'networkidle' });
    await expect(page.locator('.settings .author')).toHaveText('alice');
    await page.goto(listUrl, { waitUntil: 'networkidle' });
    await row().locator('.actions .fake-link', { hasText: 'tag' }).first().click();
    const reload = page.waitForResponse(resp => (
      resp.url().includes('/api/v1/ref?') && resp.request().method() === 'GET' && resp.ok()
    ));
    await row().locator('.inline-tagging input').fill('plugin/inbox/user/alice');
    await row().locator('.inline-tagging input').press('Enter');
    await reload;
    await pollNotifications(page, 'alice');
    await page.goto(listUrl, { waitUntil: 'networkidle' });
  });

  test('ref: edit and save updates the row', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await row().locator('.actions .fake-link', { hasText: 'edit' }).first().click();
    await row().locator('[name=title]').fill(title + ' Edited');
    await row().locator('form.form button', { hasText: 'save' }).click();
    await expect(page.locator('.ref-list .ref .link a', { hasText: title + ' Edited' })).toBeVisible();
  });

  test('ref: delete removes the ref', async () => {
    await row().locator('.actions .fake-link', { hasText: 'delete' }).first().click();
    await row().locator('.actions .fake-link', { hasText: 'yes' }).first().click();
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.ref-list .ref .link a', { hasText: title })).toHaveCount(0);
  });

  test('clear mods', async () => {
    await clearMods(page);
  });
});
