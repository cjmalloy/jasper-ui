import { expect } from '@playwright/test';
import { mod, openSidebar, test } from './setup';

test.describe.serial('Secret Plugin', () => {
  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-secrets');
  });

  test('submits secrets without the public tag', async ({ page }) => {
    await page.goto('/tag/+plugin/secret?debug=ADMIN', { waitUntil: 'networkidle' });
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'secret' }).first().click();
    await expect(page).toHaveURL(/\/submit\/web/);
    const tags = new URL(page.url()).searchParams.getAll('tag');
    expect(tags).toContain('+plugin/secret');
    expect(tags).toContain('internal');
    expect(tags).not.toContain('public');
    await expect(page.locator('.tag-field input.preview[title="+plugin/secret"]')).toBeAttached();
    await expect(page.locator('.tag-field input.preview[title="public"]')).toHaveCount(0);
  });
});
