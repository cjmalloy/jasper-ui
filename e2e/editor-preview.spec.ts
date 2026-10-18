import { expect, test } from '@playwright/test';

test.describe.serial('Editor preview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/submit/text?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.setItem('showPreview', 'true'));
    await page.reload({ waitUntil: 'networkidle' });
  });

  test('keeps an embed when typing in the same paragraph', async ({ page }) => {
    const editor = page.locator('.editor textarea:not(.measurer)');
    const preview = page.locator('.editor .md');
    await editor.fill('Before\n<img src="/assets/icons/icon-128x128.png">');
    const embed = preview.locator('.embed, a').first();
    await expect(embed).toBeVisible();
    await embed.evaluate(el => el.setAttribute('data-e2e-marker', 'kept'));

    await editor.press('End');
    await editor.pressSequentially('\nafter the embed', { delay: 20 });

    await expect(preview).toContainText('after the embed');
    await expect(preview.locator('[data-e2e-marker="kept"]')).toHaveCount(1);
  });

  test('recreates an embed when its URL changes', async ({ page }) => {
    const editor = page.locator('.editor textarea:not(.measurer)');
    const preview = page.locator('.editor .md');
    await editor.fill('Before\n<img src="/assets/icons/icon-128x128.png">\nafter');
    const embed = preview.locator('.embed, a').first();
    await expect(embed).toBeVisible();
    await embed.evaluate(el => el.setAttribute('data-e2e-marker', 'old'));

    await editor.fill('Before\n<img src="/assets/icons/icon-1024x1024.png">\nafter');

    await expect(preview.locator('.embed, a').first()).toBeVisible();
    await expect(preview.locator('[data-e2e-marker="old"]')).toHaveCount(0);
  });
});
