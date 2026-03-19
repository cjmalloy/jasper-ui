import { expect, test } from '@playwright/test';
import { clearAll } from './setup';

test.describe.serial('Mod Merge', () => {
  test('clear all', async ({ page }) => {
    await clearAll(page);
  });

  test('install store and wiki mods', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    for (const selector of ['#mod-root', '#mod-store', '#mod-wiki']) {
      if (!await page.locator(selector).isChecked()) {
        await page.locator(selector).check();
      }
    }
    await page.locator('button', { hasText: 'Save' }).click();
    await page.waitForLoadState('networkidle', { timeout: 60_000 });
    await page.goto('/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('#mod-root')).toBeChecked();
    await expect(page.locator('#mod-store')).toBeChecked();
    await expect(page.locator('#mod-wiki')).toBeChecked();
  });

  test('shows the merge popup for a locally edited wiki mod', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/settings/template?debug=ADMIN', { waitUntil: 'networkidle' });
    const uploadTemplate = async (name: string, buffer: Buffer) => {
      const saved = page.waitForResponse(resp =>
        resp.url().includes('/api/v1/template') &&
        resp.request().method() === 'POST' &&
        resp.status() === 201);
      const refreshed = page.waitForResponse(resp =>
        resp.url().includes('/api/v1/template/page') &&
        resp.status() === 200);
      await page.locator('input.upload').setInputFiles({
        name,
        mimeType: 'application/json',
        buffer,
      });
      await saved;
      await refreshed;
    };

    await uploadTemplate('config-diff.json', Buffer.from(JSON.stringify({
      tag: 'config/diff',
      config: {
        mod: '⚓️ Root',
        version: 1,
      },
    })));
    const fileContent = JSON.stringify({
      tag: 'config/wiki',
      config: {
        mod: '📔️ Wiki',
        version: 0,
        prefix: 'https://mergewiki/',
        external: true,
      },
    });
    await uploadTemplate('config.json', Buffer.from(fileContent));

    await page.goto('/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('.mod-diff-link').first()).toBeVisible();
    await page.locator('.mod-diff-link').first().click();
    await expect(page.locator('.merge-popup')).toContainText('Wiki');
    await expect(page.locator('.merge-warning')).toContainText('Unable to merge automatically');
    await page.locator('.merge-buttons button', { hasText: 'cancel' }).click();
    await expect(page.locator('.merge-popup')).toBeHidden();
  });
});
