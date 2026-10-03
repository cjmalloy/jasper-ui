import { expect } from '@playwright/test';
import { clearMods, deleteRef, openSidebar, test } from './setup';

test.describe('Backup / Restore', () => {

  test('clear mods', async ({ page }) => {
    await clearMods(page);
  });

  test('creates a ref', async ({ page }) => {
    // Clean up any existing ref from a previous failed run/retry
    await deleteRef(page, 'test:backup');
    await page.goto('/?debug=ADMIN');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('#url').fill('test:backup');
    await page.getByText('Next').click();
    await page.locator('[name=title]').fill('Backup Test');
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Backup Test');
  });

  test('creates backup', async ({ page }) => {
    await page.goto('/settings/backup?debug=ADMIN');
    await page.locator('.backup.buttons button', { hasText: '+ backup' }).click();
    // Wait for overlay to appear
    await expect(page.locator('.popup button', { hasText: '+ backup' })).toBeVisible();
    await expect(page.locator('#backupTombstones')).toBeVisible();
    await expect(page.locator('#backupTombstones')).not.toBeChecked();
    // Click backup button to create backup with default options
    await page.locator('.popup button', { hasText: '+ backup' }).click();
    await expect(page.locator('.backup .link a').first()).toHaveAttribute('href', /\.zip\?p=/);
  });

  test('deletes ref', async ({ page }) => {
    await page.goto(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'delete' }).first().click();
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'yes' }).first().click();
    await page.goto(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    await expect(page.locator('.error-404', { hasText: 'Not Found' })).toBeVisible();
  });

  test('restores backup', async ({ page }) => {
    await page.goto('/settings/backup?debug=ADMIN');
    await page.locator('.backup .actions .fake-link', { hasText: 'restore' }).first().click();
    // Wait for confirmation dialog and click yes
    await page.waitForTimeout(100);
    await page.locator('.fake-link', { hasText: 'yes' }).click();
    // Wait for options overlay to appear
    await expect(page.locator('.popup button', { hasText: 'restore' })).toBeVisible();
    await expect(page.locator('#restoreTombstones')).toBeVisible();
    await expect(page.locator('#restoreTombstones')).not.toBeChecked();
    // Click restore to restore with default options
    await page.locator('.popup button', { hasText: 'restore' }).click();
    await page.waitForTimeout(1000);
    await page.goto(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Backup Test');
  });

  test('deletes ref after restore', async ({ page }) => {
    await page.goto(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'delete' }).first().click();
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'yes' }).first().click();
    await page.goto(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    await expect(page.locator('.error-404', { hasText: 'Not Found' })).toBeVisible();
  });
});
