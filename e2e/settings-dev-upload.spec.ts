import { type APIRequestContext, expect, test } from '@playwright/test';
import { adminHeaders, openSidebar } from './setup';

test.describe.serial('Settings Dev Upload', () => {
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  async function cleanup(request: APIRequestContext) {
    await request.delete(`${api}/plugin`, { headers: await headers(request), params: { tag: 'plugin/devupload' } });
    await request.delete(`${api}/template`, { headers: await headers(request), params: { tag: 'devupload' } });
  }

  test('cleanup before', async ({ request }) => {
    await cleanup(request);
  });

  for (const tab of ['plugin', 'template']) {
    test(`shows both upload buttons on ${tab} settings`, async ({ page }) => {
      await page.goto(`/settings/${tab}?debug=ADMIN`, { waitUntil: 'networkidle' });
      await openSidebar(page);
      await expect(page.locator('.sidebar .submit-button.upload-plugin-button')).toBeVisible();
      await expect(page.locator('.sidebar .submit-button.upload-template-button')).toBeVisible();
    });
  }

  test('hides upload buttons for non-admin', async ({ page }) => {
    await page.goto('/settings/plugin?debug=USER', { waitUntil: 'networkidle' });
    await openSidebar(page);
    await expect(page.locator('.sidebar .submit-button.upload-plugin-button')).toHaveCount(0);
    await expect(page.locator('.sidebar .submit-button.upload-template-button')).toHaveCount(0);
  });

  test('upload dev plugin from template settings', async ({ page }) => {
    await page.goto('/settings/template?debug=ADMIN', { waitUntil: 'networkidle' });
    const created = page.waitForResponse(res => res.url().includes('/api/v1/plugin') && res.request().method() === 'POST');
    await page.locator('.sidebar input.upload-plugin').setInputFiles({
      name: 'plugin.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ tag: 'plugin/devupload', name: 'Dev Upload Test' })),
    });
    expect((await created).ok()).toBeTruthy();
    await page.goto('/settings/plugin?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('.plugin .link', { hasText: 'Dev Upload Test' })).toBeVisible();
  });

  test('upload dev template from plugin settings', async ({ page }) => {
    await page.goto('/settings/plugin?debug=ADMIN', { waitUntil: 'networkidle' });
    const created = page.waitForResponse(res => res.url().includes('/api/v1/template') && res.request().method() === 'POST');
    await page.locator('.sidebar input.upload-template').setInputFiles({
      name: 'template.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ tag: 'devupload', name: 'Dev Upload Template' })),
    });
    expect((await created).ok()).toBeTruthy();
    await page.goto('/settings/template?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('.template .link', { hasText: 'Dev Upload Template' })).toBeVisible();
  });

  test('cleanup after', async ({ request }) => {
    await cleanup(request);
  });
});
