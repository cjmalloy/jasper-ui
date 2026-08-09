import { expect, type Locator, test } from '@playwright/test';
import { mod } from './setup';

async function dispatchFileDragEvent(target: Locator, type: 'dragenter' | 'drop') {
  await target.evaluate((element, eventType) => {
    const data = new DataTransfer();
    data.items.add(new File(['clipboard'], 'clipboard.txt', { type: 'text/plain' }));
    element.dispatchEvent(new DragEvent(eventType, { bubbles: true, cancelable: true, dataTransfer: data }));
  }, type);
}

test.describe.serial('User Clipboard Plugin', () => {
  test('enable clipboard mod', async ({ page }) => {
    await mod(page, '#mod-experiments', '#mod-clipboard', '#mod-filecache');
  });

  test('hides the dropzone after a file drop in an editor', async ({ page }) => {
    await page.goto('/submit/text?debug=ADMIN', { waitUntil: 'networkidle' });
    const editor = page.locator('.editor textarea:not(.measurer)');
    const dropZone = page.locator('.clipboard-drop-zone');

    await dispatchFileDragEvent(editor, 'dragenter');
    await expect(dropZone).toBeVisible();

    const upload = page.waitForResponse(response =>
      response.url().includes('/api/v1/ref') && response.request().method() === 'POST');
    await dispatchFileDragEvent(editor, 'drop');
    await upload;

    await expect(dropZone).toHaveCount(0);
    await expect(editor).toHaveValue(/!\[=\]\(internal:/);
  });
});
