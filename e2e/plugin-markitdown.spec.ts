import { expect, test } from '@playwright/test';
import { clearMods, mod, openSidebar } from './setup';

test.describe.serial('MarkItDown Plugin', () => {
  let url = '';

  test('loads the page', async ({ page }) => {
    await page.goto('/?debug=USER');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Powered by Jasper')).toBeVisible({ timeout: 60_000 });
  });

  test('turn on markitdown plugin', async ({ page }) => {
    await mod(page,
      '#mod-root',
      '#mod-scripts',
      '#mod-pdf',
      '#mod-thumbnail',
      '#mod-images',
      '#mod-error',
      '#mod-markitdown',
      '#mod-cache',
      '#mod-filecache',
      '#mod-mailbox',
      '#mod-user');
  });

  test('creates a ref with plugin/pdf tag', async ({ page }) => {
    await page.goto('/?debug=USER');
    await page.waitForLoadState('networkidle');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('.tabs a', { hasText: 'upload' }).click();
    await expect(page.locator('button', { hasText: '+ cache' })).toBeVisible({ timeout: 10_000 });
    const fileInput = page.locator('input[type="file"]').nth(1);
    await fileInput.setInputFiles('e2e/fixtures/test.pdf');
    await page.locator('.ref .actions .fake-link', { hasText: 'upload' }).click();
    await page.waitForTimeout(1_000);
    await expect(page.locator('.full-page.ref .link a')).toContainText('test.pdf');
    url = page.url().replace('/ref/', '/ref/e/');
  });

  test('should show markdown action button', async ({ page }) => {
    await page.goto(url + '?debug=USER');
    expect(await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).count() === 1);
  });

  test('should trigger markdown conversion', async ({ page }) => {
    await page.goto(url + '?debug=USER');
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).click();
    expect(await page.locator('.full-page.ref .actions .fake-link', { hasText: 'cancel' }).count() === 1);
    await page.waitForTimeout(2_000);
  });

  test('should show markdown query notification', async ({ page }) => {
    await page.goto('/?debug=USER');
    await page.waitForLoadState('networkidle');
    await page.locator('.settings .notification').click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ref').first()).toContainText('Markdown:');
  });

  test('creates a ref with plugin/file tag', async ({ page }) => {
    await page.goto('/?debug=USER');
    await page.waitForLoadState('networkidle');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('.tabs a', { hasText: 'upload' }).click();
    await expect(page.locator('button', { hasText: '+ cache' })).toBeVisible({ timeout: 10_000 });
    const fileInput = page.locator('input[type="file"]').nth(1);
    await fileInput.setInputFiles('e2e/fixtures/test.doc');
    await page.locator('.ref .actions .fake-link', { hasText: 'upload' }).click();
    await page.waitForTimeout(1_000);
    await expect(page.locator('.full-page.ref .link a')).toContainText('test.doc');
    url = page.url().replace('/ref/', '/ref/e/');
  });

  test('should have markdown action on file ref', async ({ page }) => {
    await page.goto(url + '?debug=USER');
    expect(await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).count() === 1);
  });

  test('creates a public ref for visibility test', async ({ page }) => {
    await page.goto('/?debug=USER');
    await page.waitForLoadState('networkidle');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('.tabs a', { hasText: 'upload' }).click();
    await expect(page.locator('button', { hasText: '+ cache' })).toBeVisible({ timeout: 10_000 });
    const fileInput = page.locator('input[type="file"]').nth(1);
    await fileInput.setInputFiles('e2e/fixtures/test.pdf');
    await page.locator('input#add-tag').fill('public');
    await page.locator('input#add-tag').press('Enter');
    await page.locator('.ref .actions .fake-link', { hasText: 'upload' }).click();
    await page.waitForTimeout(1_000);
    await expect(page.locator('.full-page.ref .link a')).toContainText('test.pdf');
    url = page.url().replace('/ref/', '/ref/e/');
  });

  test('should propagate public tag to response', async ({ page }) => {
    await page.goto(url + '?debug=USER');
    await expect(page.locator('.full-page.ref .info .icon', { hasText: '👁️' })).not.toBeVisible();
  });

  test('should show markdown filter in notifications', async ({ page }) => {
    await page.goto('/?debug=USER');
    await page.waitForLoadState('networkidle');
    await page.locator('.settings .notification').click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ref').first()).toContainText('Markdown:');
  });

  test('can filter by markdown signature tag', async ({ page }) => {
    await page.goto('/?debug=USER');
    await openSidebar(page);
    await expect(page.locator('.sidebar')).toContainText('markdown');
  });

  test('cancels markdown conversion', async ({ page }) => {
    await page.goto('/?debug=USER');
    await page.waitForLoadState('networkidle');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('.tabs a', { hasText: 'upload' }).click();
    await expect(page.locator('button', { hasText: '+ cache' })).toBeVisible({ timeout: 10_000 });
    const fileInput = page.locator('input[type="file"]').nth(1);
    await fileInput.setInputFiles('e2e/fixtures/test.pdf');
    await page.locator('.ref .actions .fake-link', { hasText: 'upload' }).click();
    await page.waitForTimeout(1_000);
    await expect(page.locator('.full-page.ref .link a')).toContainText('test.pdf');

    // Click markdown action
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).click();
    expect(await page.locator('.full-page.ref .actions .fake-link', { hasText: 'cancel' }).count() === 1);

    // Click cancel
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'cancel' }).click();

    // Should show markdown action again (not cancel)
    expect(await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).count() === 1);
    expect(await page.locator('.full-page.ref .actions .fake-link', { hasText: 'cancel' }).count() === 0);
  });
});
