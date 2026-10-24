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
    await mod(page, '#mod-drafts', '#mod-todolist');
  });

  test('auto-saves a text post draft', async () => {
    await page.goto('/?debug=USER', { waitUntil: 'networkidle' });
    await openTextSubmit(page, '+user/debug');
    const saved = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && res.request().method() === 'POST' && res.ok());
    await page.locator('[name=title]').fill(title);
    await page.locator('.editor textarea:not(.measurer)').fill('Draft body');
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

  test('shows the draft preview with standard ref layout', async () => {
    await page.goto('/inbox/ref/plugin/editing?debug=USER', { waitUntil: 'networkidle' });
    const row = page.locator('.ref.list-item', { hasText: title }).first();
    await row.locator(':scope > button.toggle').click();
    const preview = row.locator('.ref.list-item.expand');
    await expect(preview.locator('.link a', { hasText: title })).toBeVisible();
    await expect(preview).toHaveCSS('display', 'grid');
    const toggle = await preview.locator(':scope > button.toggle').boundingBox();
    const info = await preview.locator(':scope > .info').boundingBox();
    expect(info!.x).toBeGreaterThan(toggle!.x + toggle!.width);
  });

  test('autosaves and publishes another post after adding another', async () => {
    const first = 'First Post ' + Date.now();
    const second = 'Second Post ' + Date.now();
    await page.goto('/?debug=USER', { waitUntil: 'networkidle' });
    await openTextSubmit(page, '+user/debug');
    await page.keyboard.down('Control');
    await page.locator('#addAnother').check();
    await page.keyboard.up('Control');
    const firstDraft = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && res.request().method() === 'POST' && res.ok());
    await page.locator('[name=title]').fill(first);
    await firstDraft;
    const firstPublished = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && res.request().method() === 'PUT');
    await page.locator('button[type=submit]', { hasText: 'Submit' }).click();
    expect((await firstPublished).ok()).toBe(true);
    await expect(page).toHaveURL(/\/submit\/text/);
    const secondDraft = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && ['POST', 'PATCH'].includes(res.request().method()));
    await page.locator('[name=title]').fill(second);
    const draft = await secondDraft;
    expect(draft.request().method()).toBe('POST');
    expect(draft.ok()).toBe(true);
    const secondPublished = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && res.request().method() === 'PUT');
    await page.locator('button[type=submit]', { hasText: 'Submit' }).click();
    expect((await secondPublished).ok()).toBe(true);
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
    const picker = page.locator('[title="Add Plugin"] select');
    await picker.selectOption('plugin/todo');
    await expect(page).toHaveURL(/tag=plugin(%2F|\/)todo/);
    await expect(page.locator('#to')).toHaveValue('+user/alice');
    await expect(page.locator('.tag-field input.preview[title="plugin/inbox/user/alice"]')).toBeAttached();
    await expect(page.locator('.tag-field input.preview[title="notes"]')).toHaveCount(0);
  });

  test('reopening a DM reply draft keeps its sources', async () => {
    const replyTitle = 'Reply Draft ' + Date.now();
    const parent = 'comment:parent-' + Date.now();
    await page.goto('/submit/dm?debug=USER&to=' + encodeURIComponent('+user/alice') + '&source=' + encodeURIComponent(parent), { waitUntil: 'networkidle' });
    await expect(page.locator('.tag-field input.preview[title="plugin/inbox/user/alice"]')).toBeAttached();
    await page.locator('#title').fill(replyTitle);
    const saved = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && res.request().method() === 'POST' && res.ok());
    await page.locator('button', { hasText: 'Save for later' }).click();
    await saved;
    await expect(page).toHaveURL(/\/inbox\/ref\/plugin(%2F|\/)editing/);
    await page.locator('.ref .link a', { hasText: replyTitle }).click();
    await expect(page).toHaveURL(/\/submit\/dm/);
    await expect(page.locator('#title')).toHaveValue(replyTitle);
    await expect(page.locator('#to')).toHaveValue('+user/alice');
    const published = page.waitForRequest(req =>
      req.url().includes('/api/v1/ref') && req.method() === 'PUT');
    await page.locator('button[type=submit]', { hasText: 'Send' }).click();
    expect((await published).postDataJSON().sources).toContain(parent);
  });

  test('reopening a web link draft tagged notes opens the web editor', async () => {
    const webTitle = 'Web Notes Draft ' + Date.now();
    await page.goto('/submit/web?debug=USER&tag=notes&url=' + encodeURIComponent('https://www.jasper.example/notes-draft-' + Date.now()), { waitUntil: 'networkidle' });
    await expect(page.locator('.tag-field input.preview[title="notes"]')).toBeAttached();
    await page.locator('[name=title]').fill(webTitle);
    const saved = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && res.request().method() === 'POST' && res.ok());
    await page.locator('button', { hasText: 'Save for later' }).click();
    await saved;
    await expect(page).toHaveURL(/\/inbox\/ref\/plugin(%2F|\/)editing/);
    await page.locator('.ref .link a', { hasText: webTitle }).click();
    await expect(page).toHaveURL(/\/submit\/web/);
    await expect(page.locator('[name=title]')).toHaveValue(webTitle);
  });
});

