import { expect } from '@playwright/test';
import { mod, test } from './setup';

test.describe.serial('Blog Template', () => {

  test('enable blog mod', async ({ page }) => {
    await mod(page, '#mod-blog');
  });

  test('create a public blog post', async ({ page }) => {
    await page.goto('/submit/text?tag=public&tag=blog&debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('[name=title]').fill('Blog Layout Test');
    await page.locator('.fill-editor .editor .text-wrapper textarea').fill('Blog body.');
    await page.locator('button', { hasText: 'Submit' }).click();
    await page.waitForURL(/\/ref\//);
  });

  test('edit form uses the desktop grid layout', async ({ page }) => {
    await page.goto('/tag/blog?debug=ADMIN', { waitUntil: 'networkidle' });
    const entry = page.locator('.blog-entry', { hasText: 'Blog Layout Test' });
    await entry.locator('.actions a', { hasText: /^edit$/ }).click();
    await expect(entry.locator('form.form')).toHaveCSS('display', 'grid');
  });

  test('source form uses the desktop grid layout', async ({ page }) => {
    await page.goto('/tag/blog?debug=USER&tag=alice', { waitUntil: 'networkidle' });
    const entry = page.locator('.blog-entry', { hasText: 'Blog Layout Test' });
    await entry.locator('.actions a', { hasText: /^source$/ }).click();
    await expect(entry.locator('form.form')).toHaveCSS('display', 'grid');
  });
});
