import { expect } from '@playwright/test';
import { test } from './setup';

test.describe.serial('Install Defaults', () => {
  test('installs default mods when none are installed', async ({ page }) => {
    await page.goto('/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('.mod-row input[type=checkbox]:checked')).toHaveCount(0);
    await page.locator('button.install-defaults').click();
    await page.locator('.log div', { hasText: 'Success.' }).first().waitFor({ timeout: 30_000, state: 'attached' });
    await page.goto('/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('#mod-wiki')).toBeChecked();
    await expect(page.locator('button.install-defaults')).toHaveCount(0);
  });
});
