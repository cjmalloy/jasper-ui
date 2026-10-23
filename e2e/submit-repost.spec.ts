import { expect, type Page } from '@playwright/test';
import { mod, openTextSubmit, test } from './setup';

test.describe.serial('Submit Repost and DM', () => {
  let page: Page;
  let commentUrl: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('enable mods', async () => {
    await mod(page, '#mod-todolist');
  });

  test('creates a comment to repost', async () => {
    await page.goto('/?debug=USER', { waitUntil: 'networkidle' });
    await openTextSubmit(page, '+user/debug');
    await page.locator('[name=title]').fill('Repost Source ' + Date.now());
    await page.locator('button[type=submit]', { hasText: 'Submit' }).click();
    await expect(page).toHaveURL(/\/ref\/comment/);
    commentUrl = decodeURIComponent(new URL(page.url()).pathname.substring('/ref/'.length));
    expect(commentUrl).toMatch(/^comment:/);
  });

  test('reposts a comment URL pasted into the submit page', async () => {
    await page.goto('/submit?debug=USER', { waitUntil: 'networkidle' });
    await page.locator('#url').fill(commentUrl);
    const repost = page.locator('button[type=submit]', { hasText: 'Repost' });
    await expect(repost).toBeVisible();
    await repost.click();
    await expect(page).toHaveURL(/\/submit\/web/);
    await expect(page).toHaveURL(/tag=plugin(%2F|\/)repost/);
    await expect(page.locator('.tag-field input.preview[title="plugin/repost"]')).toBeAttached();
    const created = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && res.request().method() === 'POST');
    await page.locator('button[type=submit]', { hasText: 'Submit' }).click();
    const res = await created;
    expect(res.ok()).toBe(true);
    expect(res.request().postDataJSON().url).not.toBe(commentUrl);
    expect(res.request().postDataJSON().sources).toContain(commentUrl);
    await expect(page).toHaveURL(/\/ref\/internal/);
  });

  test('keeps a typed DM recipient after picking a plugin', async () => {
    await page.goto('/submit/dm?debug=USER', { waitUntil: 'networkidle' });
    await page.locator('#to').fill('+user/alice');
    await page.locator('#title').click();
    await expect(page).toHaveURL(/to=(%2B|\+)user(%2F|\/)alice/);
    await page.locator('[title="Add Plugin"] select').selectOption('plugin/todo');
    await expect(page).toHaveURL(/tag=plugin(%2F|\/)todo/);
    await expect(page.locator('#to')).toHaveValue('+user/alice');
    await expect(page.locator('.tag-field input.preview[title="plugin/inbox/user/alice"]')).toBeAttached();
    await expect(page.locator('.tag-field input.preview[title="notes"]')).toHaveCount(0);
  });
});
