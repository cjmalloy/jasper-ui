import { expect, type Page } from '@playwright/test';
import { mod, openTextSubmit, test } from './setup';

test.describe.serial('Drafts Plugin', () => {
  let page: Page;
  const title = 'Auto Saved Draft ' + Date.now();

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('enable mods', async () => {
    await mod(page, '#mod-drafts');
  });

  test('auto-saves a text post draft', async () => {
    await page.goto('/?debug=USER', { waitUntil: 'networkidle' });
    await openTextSubmit(page, '+user/debug');
    const saved = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && res.request().method() === 'POST' && res.ok());
    await page.locator('[name=title]').fill(title);
    await saved;
  });

  test('shows the draft title in the drafts list', async () => {
    await page.goto('/inbox/ref/plugin/editing?debug=USER', { waitUntil: 'networkidle' });
    await expect(page.locator('.ref .link a', { hasText: title })).toBeVisible();
  });

  test('opens the draft in the text editor', async () => {
    await page.locator('.ref .link a', { hasText: title }).click();
    await expect(page).toHaveURL(/\/submit\/text/);
    await expect(page.locator('[name=title]')).toHaveValue(title);
  });

  test('shows the title of a web link draft in the drafts list', async () => {
    const webTitle = 'Web Draft ' + Date.now();
    await page.goto('/submit/web?debug=USER&url=' + encodeURIComponent('https://www.jasper.example/draft-' + Date.now()), { waitUntil: 'networkidle' });
    await page.locator('[name=title]').fill(webTitle);
    const saved = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && res.request().method() === 'POST' && res.ok());
    await page.locator('button', { hasText: 'Save for later' }).click();
    await saved;
    await expect(page).toHaveURL(/\/inbox\/ref\/plugin(%2F|\/)editing/);
    await expect(page.locator('.ref .link a', { hasText: webTitle })).toBeVisible();
  });

  test('restores a DM draft with its recipient and tags', async () => {
    const dmTitle = 'DM Draft ' + Date.now();
    await page.goto('/submit/dm?debug=USER&to=' + encodeURIComponent('+user/alice'), { waitUntil: 'networkidle' });
    await expect(page.locator('.tag-field input.preview[title="plugin/inbox/user/alice"]')).toBeAttached();
    await page.locator('#title').fill(dmTitle);
    const saved = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && res.request().method() === 'POST' && res.ok());
    await page.locator('button', { hasText: 'Save for later' }).click();
    await saved;
    await expect(page).toHaveURL(/\/inbox\/ref\/plugin(%2F|\/)editing/);
    await page.locator('.ref .link a', { hasText: dmTitle }).click();
    await expect(page).toHaveURL(/\/submit\/dm/);
    await expect(page.locator('#title')).toHaveValue(dmTitle);
    await expect(page.locator('#to')).toHaveValue('+user/alice');
    for (const tag of ['dm', 'plugin/thread', 'plugin/inbox/user/alice', 'user/alice']) {
      await expect(page.locator(`.tag-field input.preview[title="${tag}"]`)).toBeAttached();
    }
    await expect(page.locator('.tag-field input.preview[title="notes"]')).toHaveCount(0);
  });
});
