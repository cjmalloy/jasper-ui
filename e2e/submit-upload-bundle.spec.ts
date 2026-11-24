import { expect, Page } from '@playwright/test';
import { test } from './setup';

const bundle = JSON.stringify({
  ref: [{ url: 'https://www.example.com/upload-bundle', title: 'A' }],
  ext: [{ tag: 'grid/cols', name: 'Grid' }],
});
const notModelsError = 'JSON is not a Ref, an Ext or a { ref, ext } bundle.';

async function dropText(page: Page, text: string) {
  await page.locator('.container').first().evaluate((el, text) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('application/json', text);
    el.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }));
  }, text);
}

test.describe.serial('Upload Bundle', () => {
  test('drop a ref and ext bundle', async ({ page }) => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await dropText(page, bundle);
    await expect(page).toHaveURL(/\/submit\/upload/);
    await expect(page.locator('.full-page-upload .ext')).toHaveCount(1);
    await expect(page.locator('.full-page-upload .ref')).toHaveCount(1);
    await expect(page.locator('.full-page-upload .ref .link a').first()).toHaveText('A');
  });

  test('drop JSON that is not a model shows an error', async ({ page }) => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    const dialog = page.waitForEvent('dialog');
    await dropText(page, '{"settings":true}');
    const d = await dialog;
    expect(d.message()).toBe(notModelsError);
    await d.dismiss();
    await expect(page).not.toHaveURL(/\/submit\/upload/);
  });

  test('upload JSON that is not a model shows an error', async ({ page }) => {
    await page.goto('/submit/upload?debug=ADMIN', { waitUntil: 'networkidle' });
    const dialog = page.waitForEvent('dialog');
    await page.locator('input.upload-input').setInputFiles({
      name: 'settings.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"foo":1}'),
    });
    const d = await dialog;
    expect(d.message()).toBe(notModelsError);
    await d.dismiss();
    await expect(page.locator('.full-page-upload .ref')).toHaveCount(0);
  });

  test('upload all creates the bundled ref and ext', async ({ page }) => {
    await page.goto('/submit/upload?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('input.upload-input').setInputFiles({
      name: 'bundle.json',
      mimeType: 'application/json',
      buffer: Buffer.from(bundle),
    });
    await expect(page.locator('.full-page-upload .ext')).toHaveCount(1);
    await expect(page.locator('.full-page-upload .ref')).toHaveCount(1);
    const extCreated = page.waitForResponse(resp => resp.url().includes('/api/v1/ext') && resp.request().method() === 'POST');
    const refCreated = page.waitForResponse(resp => resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST');
    await page.locator('button', { hasText: 'upload all' }).click();
    expect((await extCreated).status()).toBe(201);
    const ref = await refCreated;
    expect(ref.status()).toBe(201);
    expect(ref.request().postDataJSON()).toEqual(expect.objectContaining({ url: 'https://www.example.com/upload-bundle', title: 'A' }));
    await expect(page).toHaveURL(/\/tag\/grid\/cols/);
  });
});
