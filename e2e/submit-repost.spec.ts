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
    await mod(page, '#mod-todolist', '#mod-plugin\\/embed');
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

  test('reposts an embed with a title without an empty embed of the repost', async () => {
    const source = 'https://www.jasper.example/embed-' + Date.now();
    // The debug login reads ?tag= as the user tag, so pick the plugin on the submit page instead
    await page.goto('/submit?debug=USER', { waitUntil: 'networkidle' });
    await page.locator('select:has(option[value="plugin/embed"])').selectOption('plugin/embed');
    await page.locator('#url').fill(source);
    await page.locator('button[type=submit]', { hasText: 'Next' }).click();
    await expect(page).toHaveURL(/\/submit\/web/);
    await expect(page.locator('.tag-field input.preview[title="plugin/embed"]')).toBeAttached();
    const source$ = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && res.request().method() === 'POST');
    await page.locator('button[type=submit]', { hasText: 'Submit' }).click();
    expect((await source$).ok()).toBe(true);
    await expect(page).toHaveURL(/\/ref\/https/);

    await page.goto('/submit?debug=USER', { waitUntil: 'networkidle' });
    await page.locator('#url').fill(source);
    await page.locator('#url').dispatchEvent('paste');
    const repost = page.locator('button[type=submit]', { hasText: 'Repost' });
    await expect(repost).toBeVisible();
    await repost.click();
    await expect(page).toHaveURL(/\/submit\/web/);
    await expect(page.locator('.tag-field input.preview[title="plugin/repost"]')).toBeAttached();
    await page.locator('[name=title]').fill('Titled Embed Repost');
    const created = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && res.request().method() === 'POST');
    await page.locator('button[type=submit]', { hasText: 'Submit' }).click();
    const req = (await created).request().postDataJSON();
    expect(req.tags).toContain('plugin/repost');
    expect(req.tags).not.toContain('plugin/embed');
    await expect(page).toHaveURL(/\/ref\/internal/);

    const viewer = page.locator('.full-page.ref > .viewer-below, .full-page.ref > .viewer-inline').first();
    await expect(viewer.locator('.ref.expand .link a', { hasText: 'embed-' })).toBeVisible();
    await expect(viewer.locator(':scope > .embed-container')).toHaveCount(0);
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
