import { expect, type Page, test } from '@playwright/test';
import { deleteRef, mod, openTextSubmit } from './setup';

test.describe.serial('PiP Plugin', () => {
  let page: Page;
  let url = '';

  test.beforeAll(async ({ browser }) => {
    // Document PiP is not available in headless browsers, so use the Electron popup fallback
    page = await browser.newPage({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Electron/33.0.0 Safari/537.36',
    });
  });

  test.afterAll(async () => {
    if (url) await deleteRef(page, url);
    await page.close();
  });

  test('enable mods', async () => {
    await mod(page, '#mod-plugin\\/pip');
  });

  test('creates a ref', async () => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await openTextSubmit(page, '+user/debug');
    await page.locator('[name=title]').fill('PiP Test');
    await page.locator('.editor textarea').fill('PiP body');
    await page.locator('.editor textarea').blur();
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    await expect(page.locator('.full-page.ref .link a')).toHaveText('PiP Test');
    url = decodeURIComponent(new URL(page.url()).pathname.replace(/^\/ref\//, ''));
  });

  test('hides viewer while in PiP and restores on close', async () => {
    const viewer = page.locator('.full-page.ref .viewer-inline');
    if (!await viewer.isVisible()) {
      await page.locator('.full-page.ref .link-below > button.toggle').click();
    }
    await expect(viewer).toBeVisible();
    await expect(viewer).not.toHaveClass(/is-hidden-in-pip/);

    const popupPromise = page.waitForEvent('popup');
    await page.locator('.full-page.ref .link-below > button.toggle').click({ button: 'right' });
    const popup = await popupPromise;
    await popup.waitForURL(/\/browse\//);
    await expect(viewer).toHaveClass(/is-hidden-in-pip/);
    await expect(viewer).toBeHidden();

    await popup.close();
    await expect(viewer).not.toHaveClass(/is-hidden-in-pip/);
    await expect(viewer).toBeVisible();
  });
});
