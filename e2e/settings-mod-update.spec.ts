import { type APIRequestContext, expect, type Page, test } from '@playwright/test';
import { adminHeaders, mod } from './setup';

test.describe.serial('Mod Update', () => {
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  let pristine: any;

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/template/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  async function getBlog(request: APIRequestContext) {
    const res = await request.get(`${api}/template`, { headers: await headers(request), params: { tag: 'blog' } });
    expect(res.ok()).toBeTruthy();
    return res.json();
  }

  function bundle(config: Record<string, any>) {
    const { tag, name, defaults, schema } = pristine;
    return { tag, name, config: { ...pristine.config, ...config }, defaults, schema };
  }

  function receiptUrl() {
    return `mod-receipt:${pristine.name}`;
  }

  /**
   * Simulate an older version of the blog mod being installed with optional local customizations.
   */
  async function installOld(request: APIRequestContext, config: Record<string, any>) {
    const current = await getBlog(request);
    const res = await request.put(`${api}/template`, {
      headers: await headers(request),
      data: { ...bundle({ version: 1, ...config }), origin: current.origin, modified: current.modified },
    });
    expect(res.ok()).toBeTruthy();
  }

  async function setReceipt(request: APIRequestContext, config?: Record<string, any>) {
    await request.delete(`${api}/ref`, { headers: await headers(request), params: { url: receiptUrl() } });
    if (!config) return;
    const res = await request.post(`${api}/ref`, {
      headers: await headers(request),
      data: {
        url: receiptUrl(),
        title: pristine.name,
        tags: ['internal', 'plugin/mod/receipt'],
        plugins: { 'plugin/mod': { template: [bundle({ version: 1, ...config })] } },
      },
    });
    expect(res.ok()).toBeTruthy();
  }

  async function openSetup(page: Page) {
    await page.goto('/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    const row = page.locator('.mod-row', { has: page.locator('#mod-blog') });
    await expect(row.locator('.mod-update-link')).toBeVisible();
    return row;
  }

  async function waitForSuccess(page: Page) {
    await page.locator('.log div', { hasText: 'Success.' }).first().waitFor({ timeout: 15_000, state: 'attached' });
  }

  async function expectAborted(page: Page, request: APIRequestContext, config: Record<string, any>) {
    const blog = await getBlog(request);
    expect(blog.config.version).toBe(1);
    for (const [key, value] of Object.entries(config)) {
      expect(blog.config[key]).toEqual(value);
    }
    await page.goto('/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    const row = page.locator('.mod-row', { has: page.locator('#mod-blog') });
    await expect(row.locator('.mod-update-link')).toBeVisible();
    await expect(row.locator('.modified-indicator')).toBeVisible();
  }

  async function expectUpdated(request: APIRequestContext, config: Record<string, any> = {}) {
    const blog = await getBlog(request);
    expect(blog.config.version).toBe(pristine.config.version);
    expect(blog.config.view).toBe(pristine.config.view);
    expect(blog.config.description).toBe(config.description ?? pristine.config.description);
    const receipt = await request.get(`${api}/ref`, { headers: await headers(request), params: { url: receiptUrl() } });
    expect(receipt.ok()).toBeTruthy();
    const logged = (await receipt.json()).plugins['plugin/mod'].template[0];
    expect(logged.config.version).toBe(pristine.config.version);
    expect(logged.config.view).toBe(pristine.config.view);
    expect(logged.config.description).toBe(pristine.config.description);
  }

  async function updateMod(page: Page) {
    const row = await openSetup(page);
    await row.locator('.mod-update-link').click();
  }

  async function updateAll(page: Page) {
    await openSetup(page);
    await page.locator('button', { hasText: 'Update All' }).click();
  }

  async function cancelMergeConflict(page: Page) {
    const popup = page.locator('.merge-popup');
    await expect(popup).toBeVisible();
    await expect(popup.locator('.merge-warning')).toContainText('Unable to merge automatically');
    await popup.locator('.merge-buttons button', { hasText: 'cancel' }).click();
    await expect(popup).toHaveCount(0);
  }

  test.afterAll(async ({ request }) => {
    if (pristine) await setReceipt(request);
  });

  test('setup', async ({ page, request }) => {
    await mod(page, '#mod-root', '#mod-blog');
    pristine = await getBlog(request);
    expect(pristine.config.version).toBeGreaterThan(1);
  });

  test('updates an unmodified mod', async ({ page, request }) => {
    await installOld(request, { view: 'OLD' });
    await setReceipt(request, { view: 'OLD' });
    const row = await openSetup(page);
    await expect(row.locator('.modified-indicator')).toHaveCount(0);
    await row.locator('.mod-update-link').click();
    await waitForSuccess(page);
    await expect(page.locator('.merge-popup')).toHaveCount(0);
    await expectUpdated(request);
  });

  test('merges local changes with the update', async ({ page, request }) => {
    await installOld(request, { view: 'OLD', description: 'Custom description' });
    await setReceipt(request, { view: 'OLD' });
    await updateMod(page);
    await waitForSuccess(page);
    await expect(page.locator('.merge-popup')).toHaveCount(0);
    await expectUpdated(request, { description: 'Custom description' });
  });

  test('aborts when local changes conflict with the update', async ({ page, request }) => {
    await installOld(request, { view: 'MINE' });
    await setReceipt(request, { view: 'OLD' });
    await updateMod(page);
    await cancelMergeConflict(page);
    await expectAborted(page, request, { view: 'MINE' });
  });

  test('aborts when there is no receipt to merge with', async ({ page, request }) => {
    await installOld(request, { description: 'Custom description' });
    await setReceipt(request);
    await updateMod(page);
    await cancelMergeConflict(page);
    await expectAborted(page, request, { description: 'Custom description' });
  });

  test('update all merges local changes with the update', async ({ page, request }) => {
    await installOld(request, { view: 'OLD', description: 'Custom description' });
    await setReceipt(request, { view: 'OLD' });
    await updateAll(page);
    await waitForSuccess(page);
    await expect(page.locator('.log div', { hasText: 'Skipped' })).toHaveCount(0);
    await expectUpdated(request, { description: 'Custom description' });
  });

  test('update all updates an unmodified mod without a receipt', async ({ page, request }) => {
    await installOld(request, {});
    await setReceipt(request);
    await updateAll(page);
    await waitForSuccess(page);
    await expect(page.locator('.log div', { hasText: 'Skipped' })).toHaveCount(0);
    await expectUpdated(request);
  });

  test('update all skips mods when local changes conflict with the update', async ({ page, request }) => {
    await installOld(request, { view: 'MINE' });
    await setReceipt(request, { view: 'OLD' });
    await updateAll(page);
    await waitForSuccess(page);
    await expect(page.locator('.log div', { hasText: `Skipped ${pristine.name} mod` }).first()).toBeAttached();
    await expectAborted(page, request, { view: 'MINE' });
  });

  test('update all skips customized mods when there is no receipt to merge with', async ({ page, request }) => {
    await installOld(request, { description: 'Custom description' });
    await setReceipt(request);
    await updateAll(page);
    await waitForSuccess(page);
    await expect(page.locator('.log div', { hasText: `Skipped ${pristine.name} mod` }).first()).toBeAttached();
    await expectAborted(page, request, { description: 'Custom description' });
  });
});
