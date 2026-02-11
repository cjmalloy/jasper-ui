import { test, expect, type Page } from '@playwright/test';
import { clearMods, openSidebar } from './setup';

test.describe('Backup / Restore', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('clear mods', async () => {
    await clearMods(page);
  });
  test('creates a ref', async () => {
    await page.goto('/?debug=ADMIN');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('#url').pressSequentially('test:backup', { delay: 100 });
    await page.getByText('Next').click();
    await page.waitForTimeout(1000); // First part of title getting truncated
    await page.locator('[name=title]').pressSequentially('Backup Test', { delay: 100 });
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Backup Test');
  });

  test('creates backup', async () => {
    await page.goto('/settings/backup?debug=ADMIN');
    await page.locator('.backup.buttons button', { hasText: '+ backup' }).click();
    // Wait for overlay to appear
    await expect(page.locator('.popup button', { hasText: '+ backup' })).toBeVisible();
    // Click backup button to create backup with default options
    await page.locator('.popup button', { hasText: '+ backup' }).click();
  });

  test('deletes ref', async () => {
    await page.goto(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'delete' }).first().click();
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'yes' }).first().click();
    await page.goto(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    await expect(page.locator('.error-404', { hasText: 'Not Found' })).toBeVisible();
  });

  test('restores backup', async () => {
    await page.goto('/settings/backup?debug=ADMIN');
    await page.locator('.backup .actions .fake-link', { hasText: 'restore' }).first().click();
    // Wait for confirmation dialog and click yes
    await page.waitForTimeout(100);
    await page.locator('.fake-link', { hasText: 'yes' }).click();
    // Wait for options overlay to appear
    await expect(page.locator('.popup button', { hasText: 'restore' })).toBeVisible();
    // Click restore to restore with default options
    await page.locator('.popup button', { hasText: 'restore' }).click();
    await page.waitForTimeout(1000);
    await page.goto(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Backup Test');
  });

  test('deletes ref after restore', async () => {
    await page.goto(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'delete' }).first().click();
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'yes' }).first().click();
    await page.goto(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    await expect(page.locator('.error-404', { hasText: 'Not Found' })).toBeVisible();
  });
});
