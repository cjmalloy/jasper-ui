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
    await expect(page.locator('.clipboard-edit')).toBeHidden();

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
    await page.locator('.clipboard-clear').click();
    await expect(bubble).toBeHidden();
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
    const refBubble = page.locator('.clipboard-bubble').filter({ hasText: 'Clipboard E2E Ref' });
    await expect(refBubble).toBeVisible();
    await refBubble.click();
    await page.locator('.clipboard-edit').click();
    await expect(page.locator('.clipboard-ref-url-edit')).toHaveValue(url);

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

  test('formats tag pastes and splits list items', async ({ page }) => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    const dropText = async (text: string) => page.locator('.clipboard-drop-zone').evaluate((element, value) => {
      const data = new DataTransfer();
      data.setData('text/plain', value);
      element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
    }, text);
    await dropText('tag:/topic/one');
    await dropText('List item one');
    await dropText('List item two');

    await page.locator('.clipboard-bubble').filter({ hasText: 'tag:/topic/one' }).last().click();
    await page.locator('body').evaluate(() => {
      const field = document.createElement('formly-field-tag-input');
      const input = document.createElement('input');
      input.className = 'e2e-tag-input';
      field.appendChild(input);
      document.body.appendChild(field);
    });
    await page.locator('.e2e-tag-input').focus();
    await expect(page.locator('.e2e-tag-input')).toHaveValue('topic/one');

    await page.locator('.clipboard-bubble').filter({ hasText: 'tag:/topic/one' }).last().click();
    await page.locator('body').evaluate(() => {
      const editor = document.createElement('app-editor');
      const textarea = document.createElement('textarea');
      textarea.className = 'e2e-editor';
      editor.appendChild(textarea);
      document.body.appendChild(editor);
    });
    await page.locator('.e2e-editor').focus();
    await expect(page.locator('.e2e-editor')).toHaveValue('#topic/one');

    await page.locator('.clipboard-bubble').filter({ hasText: 'List item one' }).last().click();
    await page.locator('.clipboard-bubble').filter({ hasText: 'List item two' }).last().click();
    await page.locator('body').evaluate(() => {
      const list = document.createElement('app-list-editor');
      const input = document.createElement('input');
      input.className = 'e2e-list-input';
      const button = document.createElement('button');
      button.addEventListener('click', () => {
        const entry = document.createElement('span');
        entry.className = 'e2e-list-entry';
        entry.textContent = input.value;
        list.appendChild(entry);
        input.value = '';
      });
      list.append(input, button);
      document.body.appendChild(list);
    });
    await page.locator('.e2e-list-input').focus();
    await expect(page.locator('.e2e-list-entry')).toHaveText(['List item one', 'List item two']);
  });
});
