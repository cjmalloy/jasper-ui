import { expect, test } from '@playwright/test';
import { deleteRef, mod, openSidebar } from './setup';

test.describe.serial('User Clipboard Plugin', () => {
  test('enable clipboard mod', async ({ page }) => {
    await mod(page, '#mod-clipboard');
  });

  test('shows bubbles and pastes selected clipboard item', async ({ page }) => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.setItem('jasper.clipboard.+user/debug@', JSON.stringify([{
        id: 'e2e-clipboard-item',
        text: 'Clipboard paste text',
        html: '<strong>Clipboard paste text</strong>',
        created: new Date().toISOString(),
        x: 12,
        y: 72,
        hold: true,
      }]));
    });
    await page.reload({ waitUntil: 'networkidle' });

    const bubble = page.locator('.clipboard-bubble').filter({ hasText: 'Clipboard paste text' });
    await expect(bubble).toBeVisible();
    await bubble.click();
    await expect(page.locator('.clipboard-edit')).toBeVisible();

    await page.locator('body').evaluate(() => {
      const input = document.createElement('input');
      input.className = 'e2e-test-input';
      document.body.appendChild(input);
    });
    await page.locator('.e2e-test-input').focus();
    await expect(page.locator('.e2e-test-input')).toHaveValue('Clipboard paste text');
    await expect.poll(async () => {
      const ref = await page.request.get('/api/v1/ref', {
        params: {
          url: 'tag:/+user/debug?url=tag:/plugin/user/clipboard',
          origin: '',
        },
      });
      const json = await ref.json();
      return json.plugins['plugin/user/clipboard'].items[0];
    }).toEqual({
      id: 'e2e-clipboard-item',
      text: 'Clipboard paste text',
      html: '<strong>Clipboard paste text</strong>',
      created: expect.any(String),
    });
  });

  test('clips refs and accepts dropped text', async ({ page }) => {
    const url = 'https://jasperkm.info/clipboard-e2e';
    await deleteRef(page, url);
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.removeItem('jasper.clipboard.+user/debug@'));
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('#url').fill(url);
    await page.getByText('Next').click();
    await page.locator('[name=title]').fill('Clipboard E2E Ref');
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;

    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'clip' }).first().click();
    await expect(page.locator('.clipboard-bubble').filter({ hasText: 'Clipboard E2E Ref' })).toBeVisible();

    const dropZone = page.locator('.clipboard-drop-zone');
    await expect(dropZone).toBeVisible();
    await dropZone.evaluate(element => {
      const data = new DataTransfer();
      data.setData('text/plain', 'Dropped clipboard text');
      element.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: data }));
      element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
    });
    await expect(page.locator('.clipboard-bubble').filter({ hasText: 'Dropped clipboard text' })).toBeVisible();
  });
});
