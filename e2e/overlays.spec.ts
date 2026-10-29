import { expect, type Page } from '@playwright/test';
import { deleteRef, mod, openSidebar, test } from './setup';

/** Click an empty spot in the bottom right corner, away from the overlay and its trigger. */
async function clickOutside(page: Page) {
  await page.mouse.click(1270, 710);
}

test.describe.serial('Overlays', () => {
  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-plugin\\/user\\/read');
  });

  test('creates a ref', async ({ page }) => {
    await deleteRef(page, 'test:overlays');
    await page.goto('/?debug=USER');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('#url').fill('test:overlays');
    await page.getByText('Next').click();
    await page.locator('[name=title]').fill('Overlays Test');
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Overlays Test');
  });

  test('action menu closes on outside click', async ({ page }) => {
    await page.goto(`/ref/e/${encodeURIComponent('test:overlays')}?debug=USER`, { waitUntil: 'networkidle' });
    const menu = page.locator('.advanced-actions');
    await page.locator('.full-page.ref .actions .show-more').click();
    await expect(menu).toBeVisible();
    await expect(menu.locator('.fake-link', { hasText: 'read' })).toBeVisible();
    await clickOutside(page);
    await expect(menu).toHaveCount(0);
  });

  test('action menu closes on Escape', async ({ page }) => {
    await page.goto(`/ref/e/${encodeURIComponent('test:overlays')}?debug=USER`, { waitUntil: 'networkidle' });
    const menu = page.locator('.advanced-actions');
    await page.locator('.full-page.ref .actions .show-more').click();
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
  });

  test('backup options close on outside click and Escape', async ({ page }) => {
    await page.goto('/settings/backup?debug=ADMIN', { waitUntil: 'networkidle' });
    const options = page.locator('.popup', { has: page.locator('#backupTombstones') });
    const open = page.locator('.backup.buttons button', { hasText: '+ backup' });
    await open.click();
    await expect(options).toBeVisible();
    await clickOutside(page);
    await expect(options).toHaveCount(0);
    await open.click();
    await expect(options).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(options).toHaveCount(0);
  });

  test('creates a backup', async ({ page }) => {
    await page.goto('/settings/backup?debug=ADMIN', { waitUntil: 'networkidle' });
    const completed = page.locator('.list-container .link a');
    const before = await completed.count();
    await page.locator('.backup.buttons button', { hasText: '+ backup' }).click();
    await page.locator('.popup button', { hasText: '+ backup' }).click();
    // The list does not poll, so reload until the new backup has finished
    await expect(async () => {
      await page.reload({ waitUntil: 'networkidle' });
      expect(await completed.count()).toBeGreaterThan(before);
    }).toPass({ timeout: 30_000 });
  });

  async function openRestoreOptions(page: Page) {
    await page.goto('/settings/backup?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('.list-container .actions .fake-link', { hasText: 'restore' }).first().click();
    // The confirm link replaces "restore" with "yes"/"no"
    await page.locator('.list-container .actions .fake-link', { hasText: 'yes' }).click();
    const options = page.locator('.popup', { has: page.locator('#restoreTombstones') });
    await expect(options).toBeVisible();
    return options;
  }

  test('restore options close on outside click', async ({ page }) => {
    const options = await openRestoreOptions(page);
    await clickOutside(page);
    await expect(options).toHaveCount(0);
  });

  test('restore options close on Escape', async ({ page }) => {
    const options = await openRestoreOptions(page);
    await page.keyboard.press('Escape');
    await expect(options).toHaveCount(0);
  });

  test('cleanup', async ({ page }) => {
    await deleteRef(page, 'test:overlays');
  });
});
