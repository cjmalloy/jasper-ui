import { expect, type Page, test } from '@playwright/test';
import { mod } from './setup';

async function showDropZone(page: Page) {
  await page.evaluate(() => {
    const data = new DataTransfer();
    document.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: data }));
  });
  const dropZone = page.locator('.clipboard-drop-zone');
  await expect(dropZone).toBeVisible();
  return dropZone;
}

test.describe.serial('User Clipboard Plugin', () => {
  test('enable clipboard mod', async ({ page }) => {
    await mod(page, '#mod-experiments', '#mod-clipboard');
  });

  test('hides the dropzone after an OS file drop', async ({ page }) => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    const dropZone = await showDropZone(page);

    await dropZone.evaluate(element => {
      const data = new DataTransfer();
      data.items.add(new File(['clipboard'], 'clipboard.txt', { type: 'text/plain' }));
      element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
    });

    await expect(dropZone).toHaveCount(0, { timeout: 500 });
    await expect(page).toHaveURL(/\/submit\/upload(?:\?|$)/);
  });
});
