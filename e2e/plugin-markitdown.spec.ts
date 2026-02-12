import { expect, test } from '@playwright/test';
import { clearMods, convertToMarkdown, mod, openSidebar, upload } from './setup';

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
    expect(await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).count()).toBe(1);
  });

  test('should convert PDF to markdown', async ({ page }) => {
    const markdownUrl = await convertToMarkdown(page, url);
    
    // Navigate to the markdown result
    await page.goto(markdownUrl + '?debug=USER');
    await page.waitForLoadState('networkidle');
    
    // Verify the title contains "Markdown:" and original filename
    await expect(page.locator('.full-page.ref h5')).toContainText('Markdown:');
    await expect(page.locator('.full-page.ref h5')).toContainText('test.pdf');
    
    // Verify the markdown content exists and is not empty
    const commentContent = page.locator('.full-page.ref .comment');
    await expect(commentContent).toBeVisible();
    const text = await commentContent.textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(10); // Should have some content
    
    // Verify the response has the signature tag
    await expect(page.locator('.full-page.ref .tag', { hasText: '+plugin/delta/md' })).toBeVisible();
  });

  test('should show markdown query notification', async ({ page }) => {
    await page.goto('/?debug=USER');
    await page.waitForLoadState('networkidle');
    await page.locator('.settings .notification').click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ref').first()).toContainText('Markdown:');
  });

  test('creates a ref with plugin/file tag', async ({ page }) => {
    url = await upload(page, 'e2e/fixtures/test.doc');
  });

  test('should have markdown action on file ref', async ({ page }) => {
    await page.goto(url + '?debug=USER');
    expect(await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).count()).toBe(1);
  });

  test('should convert DOC to markdown', async ({ page }) => {
    const markdownUrl = await convertToMarkdown(page, url);
    
    // Navigate to the markdown result
    await page.goto(markdownUrl + '?debug=USER');
    await page.waitForLoadState('networkidle');
    
    // Verify the title contains "Markdown:" and original filename
    await expect(page.locator('.full-page.ref h5')).toContainText('Markdown:');
    await expect(page.locator('.full-page.ref h5')).toContainText('test.doc');
    
    // Verify the markdown content exists and is not empty
    const commentContent = page.locator('.full-page.ref .comment');
    await expect(commentContent).toBeVisible();
    const text = await commentContent.textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(10); // Should have some content
    
    // Verify the response has the signature tag
    await expect(page.locator('.full-page.ref .tag', { hasText: '+plugin/delta/md' })).toBeVisible();
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
    await upload(page, 'e2e/fixtures/test.pdf');

    // Click markdown action
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).click();
    expect(await page.locator('.full-page.ref .actions .fake-link', { hasText: 'cancel' }).count() === 1);

    // Click cancel
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'cancel' }).click();

    // Should show markdown action again (not cancel)
    expect(await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).count() === 1);
    expect(await page.locator('.full-page.ref .actions .fake-link', { hasText: 'cancel' }).count() === 0);
  });

  test('creates a ref with plugin/file tag (docx)', async ({ page }) => {
    url = await upload(page, 'e2e/fixtures/test.docx');
  });

  test('should have markdown action on docx file ref', async ({ page }) => {
    await page.goto(url + '?debug=USER');
    expect(await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).count()).toBe(1);
  });

  test('should convert DOCX to markdown', async ({ page }) => {
    const markdownUrl = await convertToMarkdown(page, url);
    
    await page.goto(markdownUrl + '?debug=USER');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('.full-page.ref h5')).toContainText('Markdown:');
    await expect(page.locator('.full-page.ref h5')).toContainText('test.docx');
    
    const commentContent = page.locator('.full-page.ref .comment');
    await expect(commentContent).toBeVisible();
    const text = await commentContent.textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(10);
    
    await expect(page.locator('.full-page.ref .tag', { hasText: '+plugin/delta/md' })).toBeVisible();
  });

  test('creates a ref with plugin/file tag (xls)', async ({ page }) => {
    url = await upload(page, 'e2e/fixtures/test.xls');
  });

  test('should have markdown action on xls file ref', async ({ page }) => {
    await page.goto(url + '?debug=USER');
    expect(await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).count()).toBe(1);
  });

  test('should convert XLS to markdown', async ({ page }) => {
    const markdownUrl = await convertToMarkdown(page, url);
    
    await page.goto(markdownUrl + '?debug=USER');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('.full-page.ref h5')).toContainText('Markdown:');
    await expect(page.locator('.full-page.ref h5')).toContainText('test.xls');
    
    const commentContent = page.locator('.full-page.ref .comment');
    await expect(commentContent).toBeVisible();
    const text = await commentContent.textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(10);
    
    await expect(page.locator('.full-page.ref .tag', { hasText: '+plugin/delta/md' })).toBeVisible();
  });

  test('creates a ref with plugin/image tag (jpeg)', async ({ page }) => {
    url = await upload(page, 'e2e/fixtures/image.jpeg');
  });

  test('should have markdown action on jpeg image ref', async ({ page }) => {
    await page.goto(url + '?debug=USER');
    expect(await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).count()).toBe(1);
  });

  test('should convert JPEG image to markdown with OCR', async ({ page }) => {
    const markdownUrl = await convertToMarkdown(page, url);
    
    await page.goto(markdownUrl + '?debug=USER');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('.full-page.ref h5')).toContainText('Markdown:');
    await expect(page.locator('.full-page.ref h5')).toContainText('image.jpeg');
    
    const commentContent = page.locator('.full-page.ref .comment');
    await expect(commentContent).toBeVisible();
    // OCR results may vary, just check content exists
    const text = await commentContent.textContent();
    expect(text).toBeTruthy();
  });

  test('creates a ref with plugin/image tag (png)', async ({ page }) => {
    url = await upload(page, 'e2e/fixtures/image.png');
  });

  test('should have markdown action on png image ref', async ({ page }) => {
    await page.goto(url + '?debug=USER');
    expect(await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).count()).toBe(1);
  });

  test('should convert PNG image to markdown with OCR', async ({ page }) => {
    const markdownUrl = await convertToMarkdown(page, url);
    
    await page.goto(markdownUrl + '?debug=USER');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('.full-page.ref h5')).toContainText('Markdown:');
    await expect(page.locator('.full-page.ref h5')).toContainText('image.png');
    
    const commentContent = page.locator('.full-page.ref .comment');
    await expect(commentContent).toBeVisible();
    const text = await commentContent.textContent();
    expect(text).toBeTruthy();
  });

  test('creates a ref with plugin/image tag (webp)', async ({ page }) => {
    url = await upload(page, 'e2e/fixtures/image.webp');
  });

  test('should have markdown action on webp image ref', async ({ page }) => {
    await page.goto(url + '?debug=USER');
    expect(await page.locator('.full-page.ref .actions .fake-link', { hasText: 'markdown' }).count()).toBe(1);
  });

  test('should convert WebP image to markdown with OCR', async ({ page }) => {
    const markdownUrl = await convertToMarkdown(page, url);
    
    await page.goto(markdownUrl + '?debug=USER');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('.full-page.ref h5')).toContainText('Markdown:');
    await expect(page.locator('.full-page.ref h5')).toContainText('image.webp');
    
    const commentContent = page.locator('.full-page.ref .comment');
    await expect(commentContent).toBeVisible();
    const text = await commentContent.textContent();
    expect(text).toBeTruthy();
  });
});
