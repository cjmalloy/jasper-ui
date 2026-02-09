import { test, expect } from '@playwright/test';
import { openSidebar } from './setup';

test.describe('Backup / Restore', () => {
  test('creates a ref', async ({ page }) => {
    await page.goto('/?debug=ADMIN');
    await openSidebar(page);
    await page.getByText('Submit').click();
    await page.locator('#url').fill('test:backup');
    await page.getByText('Next').click();
    await page.waitForTimeout(1000); // First part of title getting truncated
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
    // Click backup button to create backup with default options
    await page.locator('.popup button', { hasText: '+ backup' }).click();
  });

  test('deletes ref', async ({ page }) => {
    await page.goto(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    await page.locator('.full-page.ref .actions').getByText('delete').click();
    await page.locator('.full-page.ref .actions').getByText('yes').click();
    await page.goto(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    await expect(page.getByText('Not Found')).toBeVisible();
  });

  test('restores backup', async ({ page }) => {
    await page.goto('/settings/backup?debug=ADMIN');
    await page.locator('.backup .actions', { hasText: 'restore' }).click();
    // Wait for confirmation dialog and click yes
    await page.locator('.fake-link', { hasText: 'yes' }).click();
    // Wait for options overlay to appear
    await expect(page.locator('.popup button', { hasText: 'restore' })).toBeVisible();
    // Click restore to restore with default options
    await page.locator('.popup button', { hasText: 'restore' }).click();
    await page.waitForTimeout(1000);
    await page.goto(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Backup Test');
  });

  test('deletes ref after restore', async ({ page }) => {
    await page.goto(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    await page.locator('.full-page.ref .actions').getByText('delete').click();
    await page.locator('.full-page.ref .actions').getByText('yes').click();
    await page.goto(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    await expect(page.getByText('Not Found')).toBeVisible();
  });
});
