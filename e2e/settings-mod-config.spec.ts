import { type APIRequestContext, expect } from '@playwright/test';
import { adminHeaders, localOrigin, mod, test } from './setup';

test.describe.serial('Mod Config', () => {
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  test('enable mods', async ({ page }) => {
    await mod(page, '[id="mod-plugin/thread"]');
  });

  test('only installed mods with admin forms have a config link', async ({ page }) => {
    await page.goto('/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    const thread = page.locator('.mod-row', { has: page.locator('[id="mod-plugin/thread"]') });
    await expect(thread.locator('.mod-config-link')).toBeVisible();
    const deleted = page.locator('.mod-row', { has: page.locator('[id="mod-plugin/delete"]') });
    await expect(deleted.locator('.mod-config-link')).toHaveCount(0);
  });

  test('edit mod config from setup page', async ({ page, request }) => {
    await page.goto('/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    const thread = page.locator('.mod-row', { has: page.locator('[id="mod-plugin/thread"]') });
    await thread.locator('.mod-config-link').click();

    const popup = page.locator('.mod-config-popup');
    await expect(popup).toBeVisible();
    await expect(popup.locator('.mod-config-form')).toHaveCount(1);
    const textarea = popup.locator('.mod-config-form .editor-field textarea');
    await expect(textarea).toHaveValue(/# plugin\/thread/);
    await textarea.fill('# Custom thread instructions');
    await popup.locator('.mod-config-save').click();
    await expect(popup).toHaveCount(0);
    await expect(page.locator('.log div', { hasText: 'config.' }).first()).toBeAttached();

    const res = await request.get(`${api}/plugin`, {
      headers: await headers(request),
      params: { tag: 'plugin/thread' + localOrigin() },
    });
    expect(res.ok()).toBeTruthy();
    const plugin = await res.json();
    expect(plugin.config.aiInstructions).toBe('# Custom thread instructions');
    expect(plugin.config.adminForm).toBeTruthy();

    await page.goto('/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    await thread.locator('.mod-config-link').click();
    await expect(popup.locator('.mod-config-form .editor-field textarea')).toHaveValue('# Custom thread instructions');
    await popup.locator('.mod-config-cancel').click();
    await expect(popup).toHaveCount(0);
  });
});
