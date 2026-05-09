import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { deleteRef, mod, openSidebar } from './setup';

const DRAG_START_OFFSET = 8; // Start inside the preview so preview-origin drags are covered.
const DRAG_END_X_OFFSET = 88; // Move far enough horizontally to exceed the click threshold.
const DRAG_END_Y_OFFSET = 48; // Move far enough vertically to exceed the click threshold.
const TEST_IMAGE_THUMBNAIL_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lY99NwAAAABJRU5ErkJggg==';
const TEST_BUBBLE_SPACING = 56;
const CLIPBOARD_STORAGE_KEY = 'jasper.clipboard.+user/debug@';

type ClipboardFixtureItem = {
  id: string;
  created: string;
  text?: string;
  html?: string;
  ref?: Record<string, unknown>;
  x?: number;
  y?: number;
  hold?: boolean;
};

function hasRemoteClipboardContent(item: ClipboardFixtureItem) {
  return item.text !== undefined || item.html !== undefined || item.ref !== undefined;
}

async function showDropZone(page: Page) {
  await page.evaluate(() => {
    const data = new DataTransfer();
    document.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: data }));
  });
  const dropZone = page.locator('.clipboard-drop-zone');
  await expect(dropZone).toBeVisible();
  return dropZone;
}

async function clearClipboard(page: Page) {
  await clearLocalClipboard(page);
}

async function clearLocalClipboard(page: Page) {
  await Promise.all([
    page.waitForEvent('framenavigated'),
    page.evaluate(key => {
      localStorage.removeItem(key);
      window.setTimeout(() => location.reload(), 0);
    }, CLIPBOARD_STORAGE_KEY),
  ]);
  await page.waitForLoadState('networkidle');
}

async function setClipboardItems(page: Page, items: ClipboardFixtureItem[]) {
  await Promise.all([
    page.waitForEvent('framenavigated'),
    page.evaluate(({ storageKey, entries }) => {
      localStorage.setItem(storageKey, JSON.stringify(entries));
      window.setTimeout(() => location.reload(), 0);
    }, { storageKey: CLIPBOARD_STORAGE_KEY, entries: items }),
  ]);
  await page.waitForLoadState('networkidle');
}

test.describe.serial('User Clipboard Plugin', () => {
  test('enable clipboard mod', async ({ page }) => {
    await mod(page, '#mod-experiments', '#mod-clipboard', '#mod-images', '#mod-thumbnail');
  });

  test('ignores file drops', async ({ page }) => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await clearClipboard(page);
    const dropFile = async (text?: string) => {
      const dropZone = await showDropZone(page);
      await dropZone.evaluate((element, value) => {
        const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lY99NwAAAABJRU5ErkJggg=='), char => char.charCodeAt(0));
        const data = new DataTransfer();
        data.items.add(new File([bytes], 'clipboard.png', { type: 'image/png' }));
        if (value) data.setData('text/plain', value);
        element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
      }, text);
    };

    await dropFile();
    await dropFile('Text with file');

    await expect(page.locator('.clipboard-bubble')).toHaveCount(0);
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]').length, CLIPBOARD_STORAGE_KEY)).toBe(0);
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

    await page.locator('.clipboard-bubble').filter({
      has: page.locator('.clipboard-preview', { hasText: 'topic/one' }),
    }).last().click();
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
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await setClipboardItems(page, [{
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
    }]);

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
  });

  test('turns tag and ref bubbles into links while hotkey is active', async ({ page }) => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    const now = new Date().toISOString();
    await setClipboardItems(page, [{
      id: 'e2e-clipboard-hotkey-tag',
      text: 'tag:/topic/hotkey',
      ref: {
        url: 'tag:/topic/hotkey',
        title: 'topic/hotkey',
      },
      created: now,
      x: 12,
      y: 72,
    }, {
      id: 'e2e-clipboard-hotkey-ref',
      ref: {
        url: 'https://jasperkm.info/hotkey-ref',
        title: 'Hotkey Ref',
      },
      created: now,
      x: 12,
      y: 128,
    }, {
      id: 'e2e-clipboard-hotkey-text',
      text: 'Plain hotkey text',
      created: now,
      x: 12,
      y: 184,
    }]);

    await page.keyboard.down('Control');
    const tagBubble = page.locator('.clipboard-bubble').filter({ hasText: 'topic/hotkey' });
    const refBubble = page.locator('.clipboard-bubble').filter({ hasText: 'Hotkey Ref' });
    const textBubble = page.locator('.clipboard-bubble').filter({ hasText: 'Plain hotkey text' });
    await expect(tagBubble.locator('a.clipboard-preview')).toHaveAttribute('href', /\/tag\/topic\/hotkey$/);
    await expect(refBubble.locator('a.clipboard-preview')).toHaveAttribute('href', /\/ref\/https:\/\/jasperkm\.info\/hotkey-ref$/);
    await expect(textBubble.locator('a.clipboard-preview')).toHaveCount(0);
    await expect(textBubble.locator('button.clipboard-preview')).toBeVisible();
    await page.keyboard.up('Control');
  });
});
