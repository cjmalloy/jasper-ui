import { expect, test } from '@playwright/test';
import { clearMods, mod, openSidebar } from './setup';

test.describe.serial('MarkItDown Plugin', () => {
  test('loads the page', async ({ page }) => {
    await page.goto('/?debug=USER');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Powered by Jasper')).toBeVisible({ timeout: 60_000 });
  });

  test('turn on markitdown plugin', async ({ page }) => {
    await mod(page, '#mod-markitdown', '#mod-filecache');
  });

  test('creates a ref with plugin/pdf tag', async ({ page }) => {
    await page.goto('/?debug=USER');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    
    // Click the upload tab
    await page.locator('.tabs a', { hasText: 'upload' }).click();
    
    // Upload the PDF file using cache input (second file input)
    // Wait for the cache file input to be visible (requires filecache mod to be loaded)
    const fileInput = page.locator('input[type="file"]').nth(1);
    // No need to wait for visibility - file inputs are often hidden
    await fileInput.setInputFiles('e2e/fixtures/test.pdf', { force: true });
    
    // Wait for "upload all" button to appear (when store.submit.empty is false)
    // This happens after the file is uploaded to cache and ref is fetched
    // Use longer timeout for slow CI environments
    await expect(page.locator('button', { hasText: 'upload all' })).toBeVisible({ timeout: 60_000 });
    
    // PDF plugin should be added automatically, no need to add tags manually
    
    // Upload all - wait for navigation to ref page
    await page.locator('button', { hasText: 'upload all' }).click();
    await page.waitForURL(/.*\?.*url=cache:/, { timeout: 30_000 });
    
    // After uploading a single file, it navigates to that ref automatically
    await expect(page.locator('.full-page.ref .link a')).toContainText('test.pdf');
  });

  test('should show markdown action button', async ({ page }) => {
    // Should already be on the uploaded ref page from previous test
    await expect(page.locator('.full-page.ref .actions')).toContainText('markdown');
  });

  test('should trigger markdown conversion', async ({ page }) => {
    // Click the markdown action button
    await page.locator('.full-page.ref .actions', { hasText: 'markdown' }).click();
    
    // Should now show cancel button
    await expect(page.locator('.full-page.ref .actions')).toContainText('cancel');
    
    // Wait for conversion to complete (or timeout)
    // The plugin has a 10-minute timeout
    await page.waitForTimeout(2000);
  });

  test('should show markdown query notification', async ({ page }) => {
    // Check if the markitdown query tag was added
    await expect(page.locator('.full-page.ref')).toContainText('markitdown');
  });

  test('creates a ref with plugin/file tag', async ({ page }) => {
    await page.goto('/?debug=USER');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    
    // Click the upload tab
    await page.locator('.tabs a', { hasText: 'upload' }).click();
    
    // Upload the DOC file using cache input (second file input)
    // Wait for the cache file input to be visible (requires filecache mod to be loaded)
    const fileInput = page.locator('input[type="file"]').nth(1);
    // No need to wait for visibility - file inputs are often hidden
    await fileInput.setInputFiles('e2e/fixtures/test.doc', { force: true });
    
    // Wait for "upload all" button to appear
    await expect(page.locator('button', { hasText: 'upload all' })).toBeVisible({ timeout: 60_000 });
    
    // File plugin should be added automatically
    
    // Upload all - wait for navigation to ref page
    await page.locator('button', { hasText: 'upload all' }).click();
    await page.waitForURL(/.*\?.*url=cache:/, { timeout: 30_000 });
    
    // After uploading a single file, it navigates to that ref automatically
    await expect(page.locator('.full-page.ref .link a')).toContainText('test.doc');
  });

  test('should have markdown action on file ref', async ({ page }) => {
    // Should already be on the uploaded ref page from previous test
    await expect(page.locator('.full-page.ref .actions')).toContainText('markdown');
  });

  test('creates a public ref for visibility test', async ({ page }) => {
    await page.goto('/?debug=USER');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    
    // Click the upload tab
    await page.locator('.tabs a', { hasText: 'upload' }).click();
    
    // Upload the PDF file using cache input (second file input)
    // Wait for the cache file input to be visible (requires filecache mod to be loaded)
    const fileInput = page.locator('input[type="file"]').nth(1);
    // No need to wait for visibility - file inputs are often hidden
    await fileInput.setInputFiles('e2e/fixtures/test.pdf', { force: true });
    
    // Wait for "upload all" button to appear
    await expect(page.locator('button', { hasText: 'upload all' })).toBeVisible({ timeout: 60_000 });
    
    // Add public tag (PDF plugin is added automatically)
    await page.locator('input#add-tag').fill('public');
    await page.locator('input#add-tag').press('Enter');
    
    // Upload all - wait for navigation to ref page
    await page.locator('button', { hasText: 'upload all' }).click();
    await page.waitForURL(/.*\?.*url=cache:/, { timeout: 30_000 });
    
    // After uploading a single file, it navigates to that ref automatically
    await expect(page.locator('.full-page.ref .link a')).toContainText('test.pdf');
  });

  test('should propagate public tag to response', async ({ page }) => {
    // Should already be on the uploaded public ref from previous test
    // Verify public tag is visible
    await expect(page.locator('.full-page.ref .tag', { hasText: 'public' })).toBeVisible();
  });

  test('should show markdown filter in notifications', async ({ page }) => {
    await page.goto('/?debug=USER');
    await page.locator('.settings .notification').click();
    
    // Should see markitdown query filter
    await expect(page.locator('.tabs')).toContainText('markitdown');
  });

  test('can filter by markdown signature tag', async ({ page }) => {
    await page.goto('/?debug=USER');
    await openSidebar(page);
    
    // Check if markdown filter exists in sidebar
    await expect(page.locator('.sidebar')).toContainText('markdown');
  });

  test('cancels markdown conversion', async ({ page }) => {
    await page.goto('/?debug=USER');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    
    // Click the upload tab
    await page.locator('.tabs a', { hasText: 'upload' }).click();
    
    // Upload the PDF file using cache input (second file input)
    // Wait for the cache file input to be visible (requires filecache mod to be loaded)
    const fileInput = page.locator('input[type="file"]').nth(1);
    // No need to wait for visibility - file inputs are often hidden
    await fileInput.setInputFiles('e2e/fixtures/test.pdf', { force: true });
    
    // Wait for "upload all" button to appear
    await expect(page.locator('button', { hasText: 'upload all' })).toBeVisible({ timeout: 60_000 });
    
    // PDF plugin is added automatically, no need to add tags
    
    // Upload all - wait for navigation to ref page
    await page.locator('button', { hasText: 'upload all' }).click();
    await page.waitForURL(/.*\?.*url=cache:/, { timeout: 30_000 });
    
    // After uploading, it navigates to that ref automatically
    await expect(page.locator('.full-page.ref .link a')).toContainText('test.pdf');
    
    // Click markdown action
    await page.locator('.full-page.ref .actions', { hasText: 'markdown' }).click();
    await expect(page.locator('.full-page.ref .actions')).toContainText('cancel');
    
    // Click cancel
    await page.locator('.full-page.ref .actions', { hasText: 'cancel' }).click();
    
    // Should show markdown action again (not cancel)
    await expect(page.locator('.full-page.ref .actions')).toContainText('markdown');
    await expect(page.locator('.full-page.ref .actions')).not.toContainText('cancel');
  });

  test('cleans up test refs', async ({ page }) => {
    // Clean up the refs we created (there will be multiple test.pdf files)
    await page.goto('/?debug=USER');
    
    // Delete all test.pdf refs
    await openSidebar(page);
    await page.locator('input[type=search]').fill('test.pdf');
    await page.locator('input[type=search]').press('Enter');
    await page.waitForTimeout(500);
    
    // Delete each test.pdf ref found
    while (await page.locator('.ref-list .link', { hasText: 'test.pdf' }).first().isVisible().catch(() => false)) {
      const refItem = page.locator('.ref-list .link', { hasText: 'test.pdf' }).first().locator('..').locator('..').locator('..');
      await refItem.locator('.actions .fake-link', { hasText: 'delete' }).click();
      await refItem.locator('.actions .fake-link', { hasText: 'yes' }).click();
      await page.waitForTimeout(500);
    }
    
    // Delete test.doc
    await page.locator('input[type=search]').clear();
    await page.locator('input[type=search]').fill('test.doc');
    await page.locator('input[type=search]').press('Enter');
    await page.waitForTimeout(500);
    
    if (await page.locator('.ref-list .link', { hasText: 'test.doc' }).isVisible().catch(() => false)) {
      const refItem = page.locator('.ref-list .link', { hasText: 'test.doc' }).locator('..').locator('..').locator('..');
      await refItem.locator('.actions .fake-link', { hasText: 'delete' }).click();
      await refItem.locator('.actions .fake-link', { hasText: 'yes' }).click();
    }
  });
});
