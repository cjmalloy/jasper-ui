import { expect, test } from '@playwright/test';
import { mod } from './setup';

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
});
