import { type Browser, expect, type Page } from '@playwright/test';
import { localOrigin, mod, openTextSubmit, test } from './setup';

test.describe.serial('Drafts Plugin', () => {
  let page: Page;
  const title = 'Auto Saved Draft ' + Date.now();

  /**
   * Save a web link draft from another origin. Origins pull from each other into sub origins, so a
   * sub origin stands in for a replicated draft.
   */
  async function saveDraftInOrigin(browser: Browser, url: string, origin: string, draftTitle: string) {
    const ctx = await browser.newContext({ extraHTTPHeaders: { 'Local-Origin': origin } });
    const other = await ctx.newPage();
    await mod(other, '#mod-drafts');
    await other.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(url), { waitUntil: 'networkidle' });
    await other.locator('[name=title]').fill(draftTitle);
    const saved = other.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && res.request().method() === 'POST' && res.ok());
    await other.locator('button', { hasText: 'Save for later' }).click();
    await saved;
    await ctx.close();
  }

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

  test('submits a web link draft from the submit page', async () => {
    const url = 'https://www.jasper.example/submit-draft-' + Date.now();
    const webTitle = 'Submit Draft ' + Date.now();
    await page.goto('/submit/web?debug=USER&url=' + encodeURIComponent(url), { waitUntil: 'networkidle' });
    await page.locator('[name=title]').fill(webTitle);
    const saved = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && res.request().method() === 'POST' && res.ok());
    await page.locator('button', { hasText: 'Save for later' }).click();
    await saved;
    await expect(page).toHaveURL(/\/inbox\/ref\/plugin(%2F|\/)editing/);
    await page.goto('/submit?debug=USER', { waitUntil: 'networkidle' });
    const checked = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref/page') && res.url().includes('responses='));
    await page.locator('#url').fill(url);
    await checked;
    const next = page.locator('button[type=submit]', { hasText: 'Next' });
    await expect(next).toBeVisible();
    await next.click();
    await expect(page).toHaveURL(/\/submit\/web/);
    await expect(page).not.toHaveURL(/plugin(%2F|\/)repost/);
    await expect(page.locator('[name=title]')).toHaveValue(webTitle);
    const published = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && res.request().method() === 'PUT');
    await page.locator('button[type=submit]', { hasText: 'Submit' }).click();
    expect((await published).ok()).toBe(true);
    await expect(page).toHaveURL(/\/ref\//);
  });

  test('does not autosave a web link draft while submitting', async () => {
    const url = 'https://www.jasper.example/slow-submit-' + Date.now();
    await page.goto('/submit/web?debug=USER&url=' + encodeURIComponent(url), { waitUntil: 'networkidle' });
    const saved = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && res.request().method() === 'POST' && res.ok());
    await page.locator('[name=title]').fill('Slow Submit ' + Date.now());
    await saved;
    await page.locator('[name=title]').fill('Slow Submit Edited ' + Date.now());
    // Hold the publish response past the autosave interval
    const refApi = (u: URL) => u.pathname.endsWith('/api/v1/ref');
    await page.route(refApi, async route => {
      if (route.request().method() !== 'PUT') return route.fallback();
      const res = await route.fetch();
      await new Promise(resolve => setTimeout(resolve, 6_000));
      await route.fulfill({ response: res });
    });
    const patches: string[] = [];
    const onRequest = (req: { url(): string, method(): string }) => {
      if (req.url().includes('/api/v1/ref') && req.method() === 'PATCH') patches.push(req.url());
    };
    page.on('request', onRequest);
    const published = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && res.request().method() === 'PUT');
    await page.locator('button[type=submit]', { hasText: 'Submit' }).click();
    expect((await published).ok()).toBe(true);
    await expect(page).toHaveURL(/\/ref\//);
    page.off('request', onRequest);
    await page.unroute(refApi);
    expect(patches).toEqual([]);
  });

  test('publishes a link with a draft replicated from another origin', async ({ browser }) => {
    const url = 'https://www.jasper.example/replicated-draft-' + Date.now();
    const webTitle = 'Replicated Draft ' + Date.now();
    await saveDraftInOrigin(browser, url, localOrigin() + '.other', webTitle);
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(url), { waitUntil: 'networkidle' });
    await expect(page.locator('[name=title]')).toHaveValue(webTitle);
    const published = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && ['POST', 'PUT'].includes(res.request().method()));
    await page.locator('button[type=submit]', { hasText: 'Submit' }).click();
    const res = await published;
    expect(res.ok(), await res.text()).toBe(true);
    await expect(page).toHaveURL(/\/ref\//);
  });

  test('publishes a saved draft when a replicated draft also exists', async ({ browser }) => {
    const url = 'https://www.jasper.example/both-drafts-' + Date.now();
    const webTitle = 'Local Draft ' + Date.now();
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(url), { waitUntil: 'networkidle' });
    await page.locator('[name=title]').fill(webTitle);
    const saved = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && res.request().method() === 'POST' && res.ok());
    await page.locator('button', { hasText: 'Save for later' }).click();
    await saved;
    await expect(page).toHaveURL(/\/inbox\/ref\/plugin(%2F|\/)editing/);
    await saveDraftInOrigin(browser, url, localOrigin() + '.other', 'Remote Draft');
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(url), { waitUntil: 'networkidle' });
    await expect(page.locator('[name=title]')).toHaveValue(webTitle);
    const published = page.waitForResponse(res =>
      res.url().includes('/api/v1/ref') && ['POST', 'PUT'].includes(res.request().method()));
    await page.locator('button[type=submit]', { hasText: 'Submit' }).click();
    const res = await published;
    expect(res.ok(), await res.text()).toBe(true);
    await expect(page).toHaveURL(/\/ref\//);
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
    await expect(page.locator('#to')).toHaveValue('+user/alice' + localOrigin());
    for (const tag of ['dm', 'plugin/thread', 'plugin/inbox/user/alice', 'user/alice']) {
      await expect(page.locator(`.tag-field input.preview[title="${tag}"]`)).toBeAttached();
    }
    await expect(page.locator('.tag-field input.preview[title="notes"]')).toHaveCount(0);
    const picker = page.locator('[title="Add Plugin"] select');
    await picker.selectOption('plugin/todo');
    await expect(page).toHaveURL(/tag=plugin(%2F|\/)todo/);
    await expect(page.locator('#to')).toHaveValue('+user/alice' + localOrigin());
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
    await expect(page.locator('#to')).toHaveValue('+user/alice' + localOrigin());
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

