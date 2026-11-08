import { expect } from '@playwright/test';
import { mod, openSidebar, test } from './setup';

test.describe.serial('Secret Plugin', () => {
  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-user', '#mod-secrets');
  });

  test('submits secrets without the public tag', async ({ page }) => {
    await page.goto('/tag/+plugin/secret?debug=ADMIN', { waitUntil: 'networkidle' });
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'secret' }).first().click();
    await expect(page).toHaveURL(/\/submit\/web/);
    const tags = new URL(page.url()).searchParams.getAll('tag');
    expect(tags).toContain('+plugin/secret');
    expect(tags).toContain('internal');
    expect(tags).toContain('plugin/pinned');
    expect(tags).not.toContain('public');
    await expect(page.locator('.tag-field input.preview[title="+plugin/secret"]')).toBeAttached();
    await expect(page.locator('.tag-field input.preview[title="public"]')).toHaveCount(0);
  });

  test('does not add the remembered public editor to secrets', async ({ page }) => {
    await page.goto('/tag/+plugin/secret?debug=ADMIN', { waitUntil: 'networkidle' });
    await openSidebar(page);
    const submit = page.locator('.sidebar .submit-button', { hasText: 'secret' }).first();
    await submit.click();
    await expect(page).toHaveURL(/\/submit\/web/);
    const addKey = page.locator('.editor button', { hasText: 'Add secret key' });
    await addKey.click();
    await page.locator('.editor textarea').click();
    const toggle = page.locator('.editor .toolbar button[title="Toggle 🌐️ Public or 👁️ Private"]');
    await expect(toggle).toHaveText('👁️');
    const saved = page.waitForResponse(res => res.url().includes('/api/v1/ext') && res.request().method() !== 'GET');
    await toggle.click();
    expect((await saved).ok()).toBe(true);
    await expect(page.locator('.tag-field input.preview[title="public"]')).toBeAttached();

    await page.goto('/tag/+plugin/secret?debug=ADMIN', { waitUntil: 'networkidle' });
    await openSidebar(page);
    await submit.click();
    await expect(page).toHaveURL(/\/submit\/web/);
    await addKey.click();
    await page.locator('.editor textarea').fill('key');
    await expect(page.locator('.tag-field input.preview[title="+plugin/secret"]')).toBeAttached();
    await expect(page.locator('.tag-field input.preview[title="plugin/pinned"]')).toBeAttached();
    await expect(toggle).toHaveText('👁️');
    await expect(page.locator('.tag-field input.preview[title="public"]')).toHaveCount(0);
  });
});
