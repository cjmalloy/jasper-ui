import { expect, type Locator, test } from '@playwright/test';
import { clearMods } from './setup';

async function dispatchFileEvent(target: Locator, type: 'drop' | 'paste', name: string) {
  await target.evaluate((element, [eventType, fileName]) => {
    const data = new DataTransfer();
    data.items.add(new File(['hello'], fileName, { type: 'text/plain' }));
    const event = eventType === 'paste'
      ? new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data })
      : new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data });
    element.dispatchEvent(event);
  }, [type, name]);
}

test.describe.serial('Submit URL input files', () => {
  test('clear mods', async ({ page }) => {
    await clearMods(page);
  });

  test('dropping a file on the url input opens upload page', async ({ page }) => {
    await page.goto('/submit?debug=USER', { waitUntil: 'networkidle' });
    await dispatchFileEvent(page.locator('input#url'), 'drop', 'dropped.txt');
    await expect(page).toHaveURL(/\/submit\/upload/);
    await expect(page.locator('.ref .link')).toContainText('dropped.txt');
  });

  test('pasting a file into the url input opens upload page', async ({ page }) => {
    await page.goto('/submit?debug=USER', { waitUntil: 'networkidle' });
    await dispatchFileEvent(page.locator('input#url'), 'paste', 'pasted.txt');
    await expect(page).toHaveURL(/\/submit\/upload/);
    await expect(page.locator('.ref .link')).toContainText('pasted.txt');
  });
});
