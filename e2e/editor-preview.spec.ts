import { expect } from '@playwright/test';
import { mod, test } from './setup';

test.describe.serial('Editor preview', () => {
  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-images');
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/submit/text?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.setItem('showPreview', 'true'));
    await page.reload({ waitUntil: 'networkidle' });
  });

  test('keeps an embed when typing in the same paragraph', async ({ page }) => {
    const editor = page.locator('.editor textarea:not(.measurer)');
    const preview = page.locator('.editor .md');
    await editor.fill('Before\n<img src="/assets/icons/icon-128x128.png">');
    const embed = preview.locator('.embed');
    await expect(embed).toHaveCount(1);
    await expect(embed.locator('.image-expand')).toBeVisible();
    await expect(preview.locator('a[href*="icon-128x128"]')).toHaveCount(0);
    await embed.evaluate(el => el.setAttribute('data-e2e-marker', 'kept'));

    await editor.press('End');
    await editor.pressSequentially('\nafter the embed', { delay: 20 });

    await expect(preview).toContainText('after the embed');
    await expect(preview.locator('.embed[data-e2e-marker="kept"]')).toHaveCount(1);
  });

  test('recreates an embed when its URL changes', async ({ page }) => {
    const editor = page.locator('.editor textarea:not(.measurer)');
    const preview = page.locator('.editor .md');
    await editor.fill('Before\n<img src="/assets/icons/icon-128x128.png">\nafter');
    const embed = preview.locator('.embed');
    await expect(embed).toHaveCount(1);
    await expect(embed.locator('.image-expand')).toBeVisible();
    await embed.evaluate(el => el.setAttribute('data-e2e-marker', 'old'));

    await editor.fill('Before\n<img src="/assets/icons/icon-1024x1024.png">\nafter');

    await expect(preview.locator('[data-e2e-marker="old"]')).toHaveCount(0);
    await expect(preview.locator('.embed')).toHaveCount(1);
    await expect(preview.locator('.embed .image-expand')).toBeVisible();
    await expect(preview.locator('a[href*="icon-1024x1024"]')).toHaveCount(0);
  });
});
