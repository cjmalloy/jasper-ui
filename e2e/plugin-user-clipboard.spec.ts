import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { deleteRef, mod, openSidebar } from './setup';

const DRAG_START_OFFSET = 8; // Start inside the preview so preview-origin drags are covered.
const DRAG_END_X_OFFSET = 88; // Move far enough horizontally to exceed the click threshold.
const DRAG_END_Y_OFFSET = 48; // Move far enough vertically to exceed the click threshold.

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
    const initialLeft = await bubble.evaluate(element => getComputedStyle(element).left);
    const previewBox = await bubble.locator('.clipboard-preview').boundingBox();
    expect(previewBox).toBeTruthy();
    await page.mouse.move(previewBox!.x + DRAG_START_OFFSET, previewBox!.y + DRAG_START_OFFSET);
    await page.mouse.down();
    await page.mouse.move(previewBox!.x + DRAG_END_X_OFFSET, previewBox!.y + DRAG_END_Y_OFFSET);
    await page.mouse.up();
    const interruptBubbleDrag = async (eventType: 'pointercancel' | 'lostpointercapture') => bubble.evaluate((element, pointerEventType) => {
      let captured = false;
      Object.defineProperties(element, {
        setPointerCapture: { value: () => { captured = true; }, configurable: true },
        hasPointerCapture: { value: () => captured, configurable: true },
        releasePointerCapture: { value: () => { captured = false; }, configurable: true },
      });
      element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 7, clientX: 20, clientY: 80 }));
      element.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, clientX: 60, clientY: 120 }));
      element.dispatchEvent(new PointerEvent(pointerEventType, { bubbles: true, pointerId: 7 }));
    }, eventType);

    await expect.poll(() => bubble.evaluate(element => getComputedStyle(element).left)).not.toBe(initialLeft);
    await expect(bubble).not.toHaveClass(/selected/);
    await expect(bubble.locator('.clipboard-hold')).toBeHidden();
    await interruptBubbleDrag('pointercancel');
    await bubble.click();
    await expect(bubble).toHaveClass(/selected/);
    await expect(bubble.locator('.clipboard-hold input')).toBeChecked();
    await bubble.locator('.clipboard-hold input').uncheck();
    await expect(bubble).not.toHaveClass(/selected/);
    await expect(bubble.locator('.clipboard-hold')).toBeHidden();
    await interruptBubbleDrag('lostpointercapture');
    await bubble.click();
    await expect(bubble).toHaveClass(/selected/);
    await expect(bubble.locator('.clipboard-hold input')).not.toBeChecked();
    await bubble.locator('.clipboard-hold input').check();
    await expect(bubble.locator('.clipboard-hold input')).toBeChecked();
    await expect(page.locator('.clipboard-edit-popup')).toBeHidden();

    await page.locator('body').evaluate(() => {
      const input = document.createElement('input');
      input.className = 'e2e-test-input';
      document.body.appendChild(input);
    });
    await page.locator('.e2e-test-input').focus();
    await expect(page.locator('.e2e-test-input')).toHaveValue('Clipboard paste text');
    await expect.poll(async () => {
      const ref = await page.request.get('/api/v1/tags/response', {
        params: {
          url: 'tag:plugin/user/clipboard',
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
    await bubble.locator('.clipboard-clear').click();
    await expect(bubble).toBeHidden();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('jasper.clipboard.+user/debug@') || '[]').length)).toBe(0);
  });

  test('clips refs and accepts dropped text', async ({ page }) => {
    const url = 'https://jasperkm.info/clipboard-e2e';
    await deleteRef(page, url);
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.removeItem('jasper.clipboard.+user/debug@'));
    await expect(page.locator('.clipboard-drop-zone')).toBeHidden();
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
    await expect(refBubble).toHaveClass(/selected/);
    await refBubble.click();
    await expect(refBubble).not.toHaveClass(/selected/);
    await refBubble.click({ button: 'right' });
    await expect(page.locator('.clipboard-edit-popup input[name=url]')).toHaveValue(url);
    await page.locator('.clipboard-edit-cancel').click();
    await refBubble.locator('.clipboard-clear').click();
    await expect(refBubble).toBeHidden();

    await showDropZone(page);
    await page.locator('.full-page.ref .link a').first().evaluate((link, refUrl) => {
      const data = new DataTransfer();
      data.setData('text/plain', refUrl as string);
      data.setData('text/uri-list', refUrl as string);
      link.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: data }));
      document.querySelector('.clipboard-drop-zone')!.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
    }, url);
    await expect(refBubble).toBeVisible();

    const dropZone = await showDropZone(page);
    await expect(dropZone).toBeVisible();
    await expect.poll(async () => (await dropZone.boundingBox())?.width || 0).toBeGreaterThanOrEqual(88);
    await expect.poll(async () => (await dropZone.boundingBox())?.height || 0).toBeGreaterThanOrEqual(88);
    await dropZone.evaluate(element => {
      const data = new DataTransfer();
      data.setData('text/plain', 'Dropped clipboard text');
      element.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: data }));
      element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
    });
    await expect(page.locator('.clipboard-bubble').filter({ hasText: 'Dropped clipboard text' })).toBeVisible();
    await expect.poll(async () => {
      const ref = await page.request.get('/api/v1/tags/response', {
        params: {
          url: 'tag:plugin/user/clipboard',
        },
      });
      const json = await ref.json();
      return json.plugins?.['plugin/user/clipboard']?.items?.map((item: { text?: string }) => item.text) || [];
    }).toContain('Dropped clipboard text');

    await showDropZone(page);
    await dropZone.evaluate(element => {
      const tagPage = `${location.origin}/tag/plugin/editing`;
      const data = new DataTransfer();
      data.setData('text/plain', tagPage);
      data.setData('text/uri-list', tagPage);
      data.setData('text/html', `<a href="${tagPage}">plugin/editing</a>`);
      element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
    });
    const tagBubble = page.locator('.clipboard-bubble').filter({ hasText: 'plugin/editing' }).last();
    await expect(tagBubble).toBeVisible();
    await expect(tagBubble.locator('.clipboard-preview')).toHaveText('plugin/editing');
    await tagBubble.click();
    await tagBubble.click({ button: 'right' });
    await expect(page.locator('.clipboard-edit-popup input[name=url]')).toHaveValue('tag:/plugin/editing');
    await page.locator('.clipboard-edit-cancel').click();
    await page.locator('.clipboard-bubble').filter({ hasText: 'Dropped clipboard text' }).click();
    await tagBubble.click({ button: 'right' });
    await page.locator('.clipboard-edit-popup input[name=url]').focus();
    await expect(page.locator('.clipboard-edit-popup input[name=url]')).toHaveValue('tag:/plugin/editing');
  });

  test('formats tag pastes and splits list items', async ({ page }) => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    const dropText = async (text: string) => (await showDropZone(page)).evaluate((element, value) => {
      const data = new DataTransfer();
      data.setData('text/plain', value);
      element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
    }, text);
    await dropText('tag:/topic/one');
    await dropText('tag:/topic/two');
    await (await showDropZone(page)).evaluate(element => {
      const tagPage = `${location.origin}/tag/topic/filtered?filter=query/old&search=hello&sort=created,desc`;
      const data = new DataTransfer();
      data.setData('text/plain', tagPage);
      data.setData('text/uri-list', tagPage);
      element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
    });
    await dropText('List item one');
    await dropText('List item two');

    await page.locator('.clipboard-bubble').filter({ hasText: 'tag:/topic/one' }).last().click();
    await page.locator('body').evaluate(() => {
      const field = document.createElement('div');
      field.className = 'tag-field';
      const input = document.createElement('input');
      input.className = 'e2e-tag-input';
      field.appendChild(input);
      document.body.appendChild(field);
    });
    await page.locator('.e2e-tag-input').focus();
    await expect(page.locator('.e2e-tag-input')).toHaveValue('topic/one');

    await page.locator('.clipboard-bubble').filter({ hasText: 'topic/filtered' }).last().click();
    await page.locator('body').evaluate(() => {
      const field = document.createElement('div');
      field.className = 'tag-field';
      const input = document.createElement('input');
      input.className = 'e2e-filtered-tag-input';
      field.appendChild(input);
      document.body.appendChild(field);
    });
    await page.locator('.e2e-filtered-tag-input').focus();
    await expect(page.locator('.e2e-filtered-tag-input')).toHaveValue('topic/filtered');

    await page.locator('.clipboard-bubble').filter({ hasText: 'topic/filtered' }).last().click();
    await page.locator('body').evaluate(() => {
      const field = document.createElement('div');
      field.className = 'query-field';
      const input = document.createElement('input');
      input.className = 'e2e-filtered-query-input';
      field.appendChild(input);
      document.body.appendChild(field);
    });
    await page.locator('.e2e-filtered-query-input').focus();
    await expect(page.locator('.e2e-filtered-query-input')).toHaveValue('topic/filtered');

    await page.locator('.clipboard-bubble').filter({ hasText: 'topic/filtered' }).last().click();
    await page.locator('body').evaluate(() => {
      const field = document.createElement('div');
      field.className = 'bookmark-field';
      const input = document.createElement('input');
      input.className = 'e2e-filtered-bookmark-input';
      field.appendChild(input);
      document.body.appendChild(field);
    });
    await page.locator('.e2e-filtered-bookmark-input').focus();
    await expect(page.locator('.e2e-filtered-bookmark-input')).toHaveValue('topic/filtered?filter=query/old&search=hello&sort=created,desc');

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

    await page.goto('/tag/old/query?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('.clipboard-bubble').filter({ hasText: 'tag:/topic/one' }).last().click();
    await page.locator('.clipboard-bubble').filter({ hasText: 'tag:/topic/two' }).last().click();
    await page.locator('.query-edit-button:visible').first().click();
    await expect(page.locator('.query-editor:visible').first()).toHaveValue('topic/one|topic/two');

    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('.clipboard-bubble').filter({ hasText: 'tag:/topic/one' }).last().click();
    await page.locator('.clipboard-bubble').filter({ hasText: 'tag:/topic/two' }).last().click();
    await page.getByRole('button', { name: '+ Add another subscription' }).click();
    const subscriptionInput = page.locator('.query-field input.grow').last();
    await subscriptionInput.click();
    await expect(subscriptionInput).toHaveValue('topic/one|topic/two');
    await expect(subscriptionInput).not.toBeFocused();

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
    await expect(page.locator('.e2e-list-input')).not.toBeFocused();
  });

  test('formats editor links and embeds', async ({ page }) => {
    const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.evaluate(image => {
      localStorage.setItem('jasper.clipboard.+user/debug@', JSON.stringify([{
        id: 'e2e-clipboard-link',
        text: 'https://jasperkm.info/plain',
        created: new Date().toISOString(),
        x: 12,
        y: 72,
      }, {
        id: 'e2e-clipboard-ref',
        ref: {
          url: 'https://jasperkm.info/ref',
          title: 'Jasper Ref',
        },
        created: new Date().toISOString(),
        x: 12,
        y: 128,
      }, {
        id: 'e2e-clipboard-image',
        image,
        created: new Date().toISOString(),
        x: 12,
        y: 184,
      }]));
    }, image);
    await page.reload({ waitUntil: 'networkidle' });

    const focusEditor = async (className: string) => {
      await page.locator('body').evaluate(name => {
        const editor = document.createElement('app-editor');
        const textarea = document.createElement('textarea');
        textarea.className = name;
        editor.appendChild(textarea);
        document.body.appendChild(editor);
      }, className);
      await page.locator(`.${className}`).focus();
      return page.locator(`.${className}`);
    };

    await page.locator('.clipboard-bubble').filter({ hasText: 'https://jasperkm.info/plain' }).click();
    const linkEditor = await focusEditor('e2e-editor-link');
    await expect(linkEditor).toHaveValue('[https://jasperkm.info/plain](https://jasperkm.info/plain)');

    await page.locator('.clipboard-bubble').filter({ hasText: 'Jasper Ref' }).click();
    const refEditor = await focusEditor('e2e-editor-ref');
    await expect(refEditor).toHaveValue('![=](https://jasperkm.info/ref)');

    await page.locator('.clipboard-bubble').filter({ hasText: 'Image' }).click();
    const imageEditor = await focusEditor('e2e-editor-image');
    await expect(imageEditor).toHaveValue(`![](${image})`);
  });
});
