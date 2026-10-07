import { expect, Page, test } from '@playwright/test';

async function dropText(page: Page, text: string, type = 'text/plain') {
  await page.locator('.container').first().evaluate((el, { text, type }) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData(type, text);
    el.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }));
  }, { text, type });
}

test.describe.serial('Upload dropped text', () => {
  const refUrl = 'https://www.example.com/upload-text-drop';
  const extTag = 'upload.text.drop';

  test('drop a ref as raw text', async ({ page }) => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await dropText(page, JSON.stringify({ url: refUrl, title: 'Dropped Ref', tags: ['public'] }));
    await expect(page).toHaveURL(/\/submit\/upload/);
    await expect(page.locator('.ref .link a').first()).toHaveText('Dropped Ref');
    await page.locator('button', { hasText: 'clear' }).click();
  });

  test('drop an ext as raw text', async ({ page }) => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await dropText(page, JSON.stringify({ tag: extTag, name: 'Dropped Ext' }), 'application/json');
    await expect(page).toHaveURL(/\/submit\/upload/);
    await expect(page.locator('.ext .link a').first()).toHaveText('Dropped Ext');
    await page.locator('button', { hasText: 'clear' }).click();
  });

  test('drop mixed refs and exts as raw text', async ({ page }) => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await dropText(page, JSON.stringify([
      { tag: extTag, name: 'Dropped Ext' },
      { url: refUrl, title: 'Dropped Ref', tags: ['public'] },
    ]));
    await expect(page).toHaveURL(/\/submit\/upload/);
    await expect(page.locator('.ext .link a').first()).toHaveText('Dropped Ext');
    await expect(page.locator('.ref .link a').first()).toHaveText('Dropped Ref');
    await page.locator('button', { hasText: 'clear' }).click();
  });

  test('ignores plain text that is not a ref or ext', async ({ page }) => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await dropText(page, 'just some text');
    await page.waitForTimeout(500);
    await expect(page).not.toHaveURL(/\/submit\/upload/);
  });
});
