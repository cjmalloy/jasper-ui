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
    await mod(page, '#mod-experiments', '#mod-clipboard', '#mod-filecache', '#mod-plugin\\/code');
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

  test('pastes a selected clipboard item into a monaco editor', async ({ page }) => {
    await page.goto('/submit/text?tag=plugin/code&debug=ADMIN', { waitUntil: 'networkidle' });
    const monaco = page.locator('.fill-editor .monaco-editor');
    await expect(monaco).toBeVisible({ timeout: 15_000 });

    await page.locator('body').evaluate(element =>
      element.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() })));
    const dropZone = page.locator('.clipboard-drop-zone');
    await expect(dropZone).toBeVisible();
    await dropZone.evaluate(element => {
      const data = new DataTransfer();
      data.setData('text/plain', 'monaco clipboard text');
      element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
    });

    const bubble = page.locator('.clipboard-bubble', { hasText: 'monaco clipboard text' });
    await bubble.locator('.clipboard-preview').click();
    await expect(bubble).toHaveClass(/selected/);

    await monaco.locator('.view-lines').click();
    await expect(monaco.locator('.view-lines')).toContainText('monaco clipboard text');
    await expect(bubble).not.toHaveClass(/selected/);
    await bubble.locator('.clipboard-preview').click();
    await bubble.locator('.clipboard-clear').click();
  });
});
