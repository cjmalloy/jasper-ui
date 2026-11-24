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
    await mod(page, '#mod-blog', '[id="mod-plugin/thread"]');
  });

  test('only installed mods with forms for defaults have a config link', async ({ page }) => {
    await page.goto('/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    const blog = page.locator('.mod-row', { has: page.locator('#mod-blog') });
    await expect(blog.locator('.mod-config-link')).toBeVisible();
    // Only has an admin form
    const thread = page.locator('.mod-row', { has: page.locator('[id="mod-plugin/thread"]') });
    await expect(thread.locator('.mod-config-link')).toHaveCount(0);
    const deleted = page.locator('.mod-row', { has: page.locator('[id="mod-plugin/delete"]') });
    await expect(deleted.locator('.mod-config-link')).toHaveCount(0);
  });

  test('edit mod defaults from setup page', async ({ page, request }) => {
    await page.goto('/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    const blog = page.locator('.mod-row', { has: page.locator('#mod-blog') });
    await blog.locator('.mod-config-link').click();

    const popup = page.locator('.mod-config-popup');
    await expect(popup).toBeVisible();
    await expect(popup.locator('.mod-config-form')).toHaveCount(1);
    const checkbox = popup.locator('.mod-config-form input[type="checkbox"]').first();
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    await popup.locator('.mod-config-save').click();
    await expect(popup).toHaveCount(0);
    await expect(page.locator('.log div', { hasText: 'config.' }).first()).toBeAttached();

    const res = await request.get(`${api}/template`, {
      headers: await headers(request),
      params: { tag: 'blog' + localOrigin() },
    });
    expect(res.ok()).toBeTruthy();
    const template = await res.json();
    expect(template.defaults.filterTags).toBe(true);
    expect(template.defaults.noFloatingSidebar).toBe(true);
    expect(template.config.form).toBeTruthy();

    await page.goto('/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    await blog.locator('.mod-config-link').click();
    await expect(popup.locator('.mod-config-form input[type="checkbox"]').first()).toBeChecked();
    await popup.locator('.mod-config-cancel').click();
    await expect(popup).toHaveCount(0);
  });
});
