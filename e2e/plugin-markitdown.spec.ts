import { expect, test } from '@playwright/test';
import { mod, openSidebar, upload } from './setup';

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
    url = await upload(page, 'e2e/fixtures/test.pdf');
  });

  test('should show markdown action button', async ({ page }) => {
    await page.goto(url + '?debug=USER');
    await expect(page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' })).toHaveCount(1);
  });

  test('should convert PDF to markdown', async ({ page }) => {
    // Navigate to the ref page and trigger conversion
    await page.goto(url + '?debug=USER');
    await page.waitForLoadState('networkidle');
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).click();

    // Wait for the conversion to complete by checking notifications
    await page.goto('/?debug=USER');
    await page.waitForLoadState('networkidle');
    await page.locator('.settings .notification').click();
    await page.locator('.tabs a', { hasText: 'all' }).first().click();
    await page.locator('.ref', { hasText: 'Markdown:' }).first().locator('a').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.full-page.ref .md')).toContainText('PDF BOOKMARK SAMPLE');
  });

  test('should show markdown query notification', async ({ page }) => {
    await page.goto('/?debug=USER');
    await page.waitForLoadState('networkidle');
    await page.locator('.settings .notification').click();
    await page.locator('.tabs a', { hasText: 'all' }).first().click();
    await expect(page.locator('.ref').first()).toContainText('Markdown:');
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

  test('can filter by markdown signature tag', async ({ page }) => {
    await page.goto('/?debug=USER');
    await openSidebar(page);
    await expect(page.locator('.sidebar')).toContainText('markdown');
  });

  test('cancels markdown conversion', async ({ page }) => {
    await upload(page, 'e2e/fixtures/test.pdf');

    // Click markdown action
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).click();
    await expect(page.locator('.full-page.ref .actions .fake-link', { hasText: 'cancel' })).toHaveCount(1);

    // Click cancel
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'cancel' }).click();

    // Should show markdown action again (not cancel)
    await expect(page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' })).toHaveCount(1);
    await expect(page.locator('.full-page.ref .actions .fake-link', { hasText: 'cancel' })).toHaveCount(0);
  });

  test('creates a ref with plugin/file tag (docx)', async ({ page }) => {
    url = await upload(page, 'e2e/fixtures/test.docx');
  });

  test('should have markdown action on docx file ref', async ({ page }) => {
    await page.goto(url + '?debug=USER');
    await expect(page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' })).toHaveCount(1);
  });

  test('should convert DOCX to markdown', async ({ page }) => {
    // Navigate to the ref page and trigger conversion
    await page.goto(url + '?debug=USER');
    await page.waitForLoadState('networkidle');
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).click();

    // Wait for the conversion to complete by checking notifications
    await page.goto('/?debug=USER');
    await page.waitForLoadState('networkidle');
    await page.locator('.settings .notification').click();
    await page.locator('.tabs a', { hasText: 'all' }).first().click();
    await page.locator('.ref', { hasText: 'Markdown:' }).first().locator('a').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.full-page.ref .md')).toContainText('This is a Word Document File (DOCX)');
  });

  test('creates a ref with plugin/file tag (xls)', async ({ page }) => {
    url = await upload(page, 'e2e/fixtures/test.xls');
  });

  test('should have markdown action on xls file ref', async ({ page }) => {
    await page.goto(url + '?debug=USER');
    await expect(page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' })).toHaveCount(1);
  });

  test('should convert XLS to markdown', async ({ page }) => {
    // Navigate to the ref page and trigger conversion
    await page.goto(url + '?debug=USER');
    await page.waitForLoadState('networkidle');
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).click();

    // Wait for the conversion to complete by checking notifications
    await page.goto('/?debug=USER');
    await page.waitForLoadState('networkidle');
    await page.locator('.settings .notification').click();
    await page.locator('.tabs a', { hasText: 'all' }).first().click();
    await page.locator('.ref', { hasText: 'Markdown:' }).first().locator('a').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.full-page.ref .md')).toContainText('Example Test');
  });

  test('creates a ref with plugin/image tag (jpeg)', async ({ page }) => {
    url = await upload(page, 'e2e/fixtures/image.jpeg');
  });

  test('should have markdown action on jpeg image ref', async ({ page }) => {
    await page.goto(url + '?debug=USER');
    await expect(page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' })).toHaveCount(1);
  });

  test('should convert JPEG image to markdown (OCR unavailable)', async ({ page }) => {
    // Navigate to the ref page and trigger conversion
    await page.goto(url + '?debug=USER');
    await page.waitForLoadState('networkidle');
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).click();

    // Wait for the conversion to complete by checking notifications
    await page.goto('/?debug=USER');
    await page.waitForLoadState('networkidle');
    await page.locator('.settings .notification').click();
    await page.locator('.tabs a', { hasText: 'all' }).first().click();
    await page.locator('.ref', { hasText: 'Markdown:' }).first().locator('a').first().click();
    await page.waitForLoadState('networkidle');
    // Without Tesseract-OCR, images return a fallback message
    await expect(page.locator('.full-page.ref .md')).toContainText('No text content could be extracted from plugin/image');
  });

  test('creates a ref with plugin/image tag (png)', async ({ page }) => {
    url = await upload(page, 'e2e/fixtures/image.png');
  });

  test('should have markdown action on png image ref', async ({ page }) => {
    await page.goto(url + '?debug=USER');
    await expect(page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' })).toHaveCount(1);
  });

  test('should convert PNG image to markdown (OCR unavailable)', async ({ page }) => {
    // Navigate to the ref page and trigger conversion
    await page.goto(url + '?debug=USER');
    await page.waitForLoadState('networkidle');
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).click();

    // Wait for the conversion to complete by checking notifications
    await page.goto('/?debug=USER');
    await page.waitForLoadState('networkidle');
    await page.locator('.settings .notification').click();
    await page.locator('.tabs a', { hasText: 'all' }).first().click();
    await page.locator('.ref', { hasText: 'Markdown:' }).first().locator('a').first().click();
    await page.waitForLoadState('networkidle');
    // Without Tesseract-OCR, images return a fallback message
    await expect(page.locator('.full-page.ref .md')).toContainText('No text content could be extracted from plugin/image');
  });

  test('creates a ref with plugin/image tag (webp)', async ({ page }) => {
    url = await upload(page, 'e2e/fixtures/image.webp');
  });

  test('should have markdown action on webp image ref', async ({ page }) => {
    await page.goto(url + '?debug=USER');
    await expect(page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' })).toHaveCount(1);
  });

  test('should convert WebP image to markdown (OCR unavailable)', async ({ page }) => {
    // Navigate to the ref page and trigger conversion
    await page.goto(url + '?debug=USER');
    await page.waitForLoadState('networkidle');
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).click();

    // Wait for the conversion to complete by checking notifications
    await page.goto('/?debug=USER');
    await page.waitForLoadState('networkidle');
    await page.locator('.settings .notification').click();
    await page.locator('.tabs a', { hasText: 'all' }).first().click();
    await page.locator('.ref', { hasText: 'Markdown:' }).first().locator('a').first().click();
    await page.waitForLoadState('networkidle');
    // Without Tesseract-OCR, images return a fallback message
    await expect(page.locator('.full-page.ref .md')).toContainText('No text content could be extracted from plugin/image');
  });
});
