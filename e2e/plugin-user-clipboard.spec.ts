import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { deleteRef, mod, openSidebar } from './setup';

const DRAG_START_OFFSET = 8; // Start inside the preview so preview-origin drags are covered.
const DRAG_END_X_OFFSET = 88; // Move far enough horizontally to exceed the click threshold.
const DRAG_END_Y_OFFSET = 48; // Move far enough vertically to exceed the click threshold.
const TEST_IMAGE_THUMBNAIL_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lY99NwAAAABJRU5ErkJggg==';
const TEST_BUBBLE_SPACING = 56;
const CLIPBOARD_STORAGE_KEY = 'jasper.clipboard.+user/debug@';

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
  await page.request.patch('/api/v1/tags/response', {
    params: {
      tags: 'plugin/user/clipboard',
      url: 'tag:plugin/user/clipboard',
    },
    headers: { 'Content-Type': 'application/merge-patch+json' },
    data: {
      'plugin/user/clipboard': {
        items: [],
      },
    },
  });
  await page.evaluate(key => localStorage.removeItem(key), CLIPBOARD_STORAGE_KEY);
}

test.describe.serial('User Clipboard Plugin', () => {
  test('enable clipboard mod', async ({ page }) => {
    await mod(page, '#mod-experiments', '#mod-clipboard', '#mod-image');
  });

  test('keeps many bubbles on screen in columns', async ({ page }) => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await clearClipboard(page);
    const viewportHeight = page.viewportSize()?.height ?? 720;
    const overflowCount = Math.ceil(viewportHeight / TEST_BUBBLE_SPACING) + 2;
    await page.evaluate(({ overflowCount, storageKey }) => {
      const now = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify([
        ...Array.from({ length: overflowCount }, (_, index) => ({
          id: `e2e-overflow-${index}`,
          text: `Overflow clipboard item ${index}`,
          created: now,
        })),
        {
          id: 'e2e-offscreen',
          text: 'Offscreen clipboard item',
          created: now,
          x: -240,
          y: 9999,
        },
      ]));
    }, { overflowCount, storageKey: CLIPBOARD_STORAGE_KEY });
    await page.reload({ waitUntil: 'networkidle' });

    const first = page.locator('.clipboard-bubble').filter({ hasText: 'Overflow clipboard item 0' });
    await expect(first).toBeVisible();
    const firstBox = await first.boundingBox();
    expect(firstBox).toBeTruthy();
    await expect.poll(() => page.locator('.clipboard-bubble').evaluateAll((elements, firstLeft) => (
      elements.some(element => element.getBoundingClientRect().left > (firstLeft as number) + 10)
    ), firstBox!.x)).toBe(true);
    const offscreen = page.locator('.clipboard-bubble').filter({ hasText: 'Offscreen clipboard item' });
    await expect(offscreen).toBeInViewport();
    const offscreenBox = await offscreen.boundingBox();
    expect(offscreenBox).toBeTruthy();
    expect(offscreenBox!.x).toBeGreaterThanOrEqual(0);
    expect(offscreenBox!.y).toBeLessThan(viewportHeight);
    await expect.poll(() => page.locator('.clipboard-bubble').evaluateAll(elements => {
      const { innerWidth, innerHeight } = window;
      return elements.every(element => {
        const box = element.getBoundingClientRect();
        return box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight;
      });
    })).toBe(true);

    await clearClipboard(page);
  });

  test('shows bubbles and pastes selected clipboard item', async ({ page }) => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await clearClipboard(page);
    await page.evaluate(storageKey => {
      localStorage.setItem(storageKey, JSON.stringify([{
        id: 'e2e-clipboard-item',
        text: 'Clipboard paste text',
        html: '<strong>Clipboard paste text</strong>',
        ref: {
          url: 'https://jasperkm.info/clipboard-thumbnail-ref',
          title: 'Clipboard paste text',
          tags: ['plugin/thumbnail'],
          plugins: {
            'plugin/thumbnail': {
              url: 'https://jasperkm.info/clipboard-thumbnail.png',
              color: '#123456',
              emoji: '📋️',
            },
          },
        },
        created: new Date().toISOString(),
        x: 12,
        y: 72,
        hold: true,
      }, {
        id: 'e2e-clipboard-image-thumbnail-item',
        text: 'Clipboard image thumbnail',
        ref: {
          url: 'https://jasperkm.info/clipboard-image-default-ref',
          title: 'Clipboard image thumbnail',
          tags: ['plugin/image'],
          plugins: {
            'plugin/image': {
              url: TEST_IMAGE_THUMBNAIL_DATA_URL,
            },
          },
        },
        created: new Date().toISOString(),
        x: 12,
        y: 128,
      }, {
        id: 'e2e-clipboard-image-default-item',
        text: 'Clipboard image default emoji',
        ref: {
          url: 'https://jasperkm.info/clipboard-image-default-ref',
          title: 'Clipboard image default emoji',
          tags: ['plugin/image'],
        },
        created: new Date().toISOString(),
        x: 12,
        y: 184,
      }, {
        id: 'e2e-clipboard-comment-title-item',
        ref: {
          url: 'https://jasperkm.info/clipboard-comment-title-ref',
          comment: 'Clipboard comment title\n\nExtra body text',
        },
        created: new Date().toISOString(),
        x: 12,
        y: 240,
      }]));
    }, CLIPBOARD_STORAGE_KEY);
    await page.reload({ waitUntil: 'networkidle' });

    const bubble = page.locator('.clipboard-bubble').filter({ hasText: 'Clipboard paste text' });
    await expect(bubble).toBeVisible();
    await expect(bubble.locator('.clipboard-thumbnail')).toBeVisible();
    await expect(bubble.locator('.clipboard-thumbnail')).toHaveCSS('background-color', 'rgb(18, 52, 86)');
    await expect(bubble.locator('.clipboard-thumbnail-image')).toHaveCSS('background-image', /clipboard-thumbnail\.png/);
    await expect(bubble.locator('.clipboard-thumbnail-emoji')).toBeVisible();
    await expect(bubble.locator('.clipboard-thumbnail-emoji')).toHaveText('📋️');
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]')[0]?.ref?.plugins, CLIPBOARD_STORAGE_KEY)).toEqual({
      'plugin/thumbnail': expect.objectContaining({
        url: 'https://jasperkm.info/clipboard-thumbnail.png',
        color: '#123456',
        emoji: '📋️',
      }),
    });
    const imageBubble = page.locator('.clipboard-bubble').filter({ hasText: 'Clipboard image thumbnail' });
    await expect(imageBubble).toBeVisible();
    await expect(imageBubble.locator('.clipboard-thumbnail-image')).toHaveCSS('background-image', /data:image\/png/);
    await expect(imageBubble.locator('.clipboard-thumbnail-emoji')).toBeHidden();
    const defaultEmojiBubble = page.locator('.clipboard-bubble').filter({ hasText: 'Clipboard image default emoji' });
    await expect(defaultEmojiBubble).toBeVisible();
    await expect(defaultEmojiBubble.locator('.clipboard-thumbnail-emoji')).toHaveText('🖼️');
    const commentTitleBubble = page.locator('.clipboard-bubble').filter({ hasText: 'Clipboard comment title' });
    await expect(commentTitleBubble).toBeVisible();
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
    await expect(page.locator('.clipboard-edit-popup')).toHaveCount(0);

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
      ref: {
        url: 'https://jasperkm.info/clipboard-thumbnail-ref',
        title: 'Clipboard paste text',
        tags: ['plugin/thumbnail'],
        plugins: {
          'plugin/thumbnail': {
            url: 'https://jasperkm.info/clipboard-thumbnail.png',
            color: '#123456',
            emoji: '📋️',
          },
        },
      },
      created: expect.any(String),
    });
    await expect(imageBubble.locator('.clipboard-thumbnail-image')).toHaveCSS('background-image', /data:image\/png/);
    await expect(imageBubble.locator('.clipboard-thumbnail-emoji')).toBeHidden();
    await bubble.locator('.clipboard-clear').click();
    await expect(bubble).toBeHidden();
    await imageBubble.locator('.clipboard-clear').click();
    await expect(imageBubble).toBeHidden();
    await defaultEmojiBubble.locator('.clipboard-clear').click();
    await expect(defaultEmojiBubble).toBeHidden();
    await commentTitleBubble.locator('.clipboard-clear').click();
    await expect(commentTitleBubble).toBeHidden();
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]').length, CLIPBOARD_STORAGE_KEY)).toBe(0);
  });

  test('clips refs and accepts dropped text', async ({ page }) => {
    const url = 'https://jasperkm.info/clipboard-e2e';
    await deleteRef(page, url);
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.evaluate(key => localStorage.removeItem(key), CLIPBOARD_STORAGE_KEY);
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
    const beforeContextMenu = await page.evaluate(key => localStorage.getItem(key), CLIPBOARD_STORAGE_KEY);
    await refBubble.dispatchEvent('contextmenu');
    await expect(page.locator('.clipboard-edit-popup')).toHaveCount(0);
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), CLIPBOARD_STORAGE_KEY)).toBe(beforeContextMenu);
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
    await page.locator('.clipboard-bubble').filter({ hasText: 'Dropped clipboard text' }).click();
    const beforeTagContextMenu = await page.evaluate(key => localStorage.getItem(key), CLIPBOARD_STORAGE_KEY);
    await tagBubble.dispatchEvent('contextmenu');
    await expect(page.locator('.clipboard-edit-popup')).toHaveCount(0);
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), CLIPBOARD_STORAGE_KEY)).toBe(beforeTagContextMenu);
    await expect.poll(() => page.evaluate(key => {
      const items = JSON.parse(localStorage.getItem(key) || '[]') as { ref?: { url?: string } }[];
      return items.find(item => item.ref?.url === 'tag:/plugin/editing')?.ref?.url;
    }, CLIPBOARD_STORAGE_KEY)).toBe('tag:/plugin/editing');
  });

  test('copies tag query and bookmark links as tag refs', async ({ page }) => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await clearClipboard(page);
    await page.locator('body').evaluate(() => {
      const links = [{
        className: 'e2e-copied-tag-link',
        href: '/tag/copied/tag',
        text: 'Copied tag',
      }, {
        className: 'e2e-copied-query-link',
        href: '/tag/copied/query?filter=query/old&search=hello&sort=created,desc',
        text: 'Copied query',
      }, {
        className: 'e2e-copied-bookmark-link',
        href: '/tag/copied/bookmark?filter=query/new&search=saved&sort=modified,asc',
        text: 'Copied bookmark',
      }];
      for (const config of links) {
        const link = document.createElement('a');
        link.className = config.className;
        link.href = config.href;
        link.textContent = config.text;
        document.body.appendChild(link);
        link.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true }));
      }
    });

    const tagBubble = page.locator('.clipboard-bubble').filter({ hasText: 'Copied tag' });
    const queryBubble = page.locator('.clipboard-bubble').filter({ hasText: 'Copied query' });
    const bookmarkBubble = page.locator('.clipboard-bubble').filter({ hasText: 'Copied bookmark' });
    await expect(tagBubble).toBeVisible();
    await expect(queryBubble).toBeVisible();
    await expect(bookmarkBubble).toBeVisible();
    await expect.poll(() => page.evaluate(key => {
      const items = JSON.parse(localStorage.getItem(key) || '[]') as { ref?: { url?: string } }[];
      return items.map(item => item.ref?.url).filter(Boolean);
    }, CLIPBOARD_STORAGE_KEY)).toEqual(expect.arrayContaining([
      'tag:/copied/tag',
      'tag:/copied/query?filter=query/old&search=hello&sort=created,desc',
      'tag:/copied/bookmark?filter=query/new&search=saved&sort=modified,asc',
    ]));

    await queryBubble.click();
    await page.locator('body').evaluate(() => {
      const field = document.createElement('div');
      field.className = 'tag-field';
      const input = document.createElement('input');
      input.className = 'e2e-copied-query-tag-input';
      field.appendChild(input);
      document.body.appendChild(field);
    });
    await page.locator('.e2e-copied-query-tag-input').focus();
    await expect(page.locator('.e2e-copied-query-tag-input')).toHaveValue('copied/query');

    await bookmarkBubble.click();
    await page.locator('body').evaluate(() => {
      const field = document.createElement('div');
      field.className = 'bookmark-field';
      const input = document.createElement('input');
      input.className = 'e2e-copied-bookmark-input';
      field.appendChild(input);
      document.body.appendChild(field);
    });
    await page.locator('.e2e-copied-bookmark-input').focus();
    await expect(page.locator('.e2e-copied-bookmark-input')).toHaveValue('copied/bookmark?filter=query/new&search=saved&sort=modified,asc');
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]').map((item: { ref?: { url?: string } }) => item.ref?.url), CLIPBOARD_STORAGE_KEY)).toEqual([
      'tag:/copied/tag',
      'tag:/copied/query?filter=query/old&search=hello&sort=created,desc',
      'tag:/copied/bookmark?filter=query/new&search=saved&sort=modified,asc',
    ]);
  });

  test('keeps image data local-only during remote sync', async ({ page }) => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await clearClipboard(page);
    const dropImage = async (text?: string) => {
      const dropZone = await showDropZone(page);
      await dropZone.evaluate((element, value) => {
        const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lY99NwAAAABJRU5ErkJggg=='), char => char.charCodeAt(0));
        const data = new DataTransfer();
        data.items.add(new File([bytes], 'clipboard.png', { type: 'image/png' }));
        if (value) data.setData('text/plain', value);
        element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
      }, text);
    };

    await dropImage();
    await dropImage('Text with local image');

    await expect(page.locator('.clipboard-bubble').filter({ hasText: 'Image' })).toBeVisible();
    await expect(page.locator('.clipboard-bubble').filter({ hasText: 'Text with local image' })).toBeVisible();
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]').length, CLIPBOARD_STORAGE_KEY)).toBe(2);
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]'), CLIPBOARD_STORAGE_KEY)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        image: expect.stringMatching(/^data:image\/png;base64,/),
      }),
      expect.objectContaining({
        text: 'Text with local image',
        image: expect.stringMatching(/^data:image\/png;base64,/),
      }),
    ]));
    await expect.poll(async () => {
      const ref = await page.request.get('/api/v1/tags/response', {
        params: {
          url: 'tag:plugin/user/clipboard',
        },
      });
      const json = await ref.json();
      return json.plugins['plugin/user/clipboard'].items;
    }).toEqual([{
      id: expect.any(String),
      text: 'Text with local image',
      created: expect.any(String),
    }]);
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
    const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.evaluate(({ image, storageKey }) => {
      localStorage.setItem(storageKey, JSON.stringify([{
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
    }, { image, storageKey: CLIPBOARD_STORAGE_KEY });
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
