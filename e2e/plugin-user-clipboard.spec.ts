import { type APIRequestContext, expect, type Locator, type Page } from '@playwright/test';
import { adminHeaders, localOrigin, mod, test } from './setup';

async function dispatchFileDragEvent(target: Locator, type: 'dragenter' | 'drop') {
  await target.evaluate((element, eventType) => {
    const data = new DataTransfer();
    data.items.add(new File(['clipboard'], 'clipboard.txt', { type: 'text/plain' }));
    element.dispatchEvent(new DragEvent(eventType, { bubbles: true, cancelable: true, dataTransfer: data }));
  }, type);
}

test.describe.serial('User Clipboard Plugin', () => {
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';

  test('enable clipboard mod', async ({ page }) => {
    await mod(page, '#mod-experiments', '#mod-clipboard', '#mod-cache', '#mod-filecache', '#mod-plugin\\/code', '#mod-images', '#mod-thumbnail');
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

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  async function setInterceptCopy(request: APIRequestContext, interceptCopy: boolean) {
    const res = await request.patch(`${api}/tags/response`, {
      headers: { ...await headers(request), 'Content-Type': 'application/merge-patch+json' },
      params: { tags: 'plugin/user/clipboard', url: 'tag:/plugin/user/clipboard' },
      data: { 'plugin/user/clipboard': { interceptCopy } },
    });
    expect(res.ok()).toBe(true);
  }

  async function cacheImage(request: APIRequestContext) {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
    const res = await request.post(`${api}/proxy`, {
      headers: { ...await headers(request), 'Content-Type': 'image/png' },
      params: { title: 'clip.png', mime: 'image/png', origin: localOrigin() },
      data: png,
    });
    expect(res.ok(), await res.text()).toBe(true);
    return (await res.json()).url as string;
  }

  async function embedImage(page: Page, request: APIRequestContext) {
    const url = await cacheImage(request);
    await page.goto('/submit/text?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.setItem('showPreview', 'true'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.editor textarea:not(.measurer)').fill(`![](${url})`);
    const image = page.locator('.editor .md .embed .image-expand');
    await expect(image).not.toHaveClass(/loading/);
    return image;
  }

  test('copies an embedded image to the system clipboard on click', async ({ page, context, request }) => {
    await setInterceptCopy(request, false);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const image = await embedImage(page, request);
    const bubbles = page.locator('.clipboard-bubble');
    const before = await bubbles.count();

    const box = (await image.boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 50, box.y + 50, { steps: 5 });
    await page.mouse.up();
    await expect(image).not.toHaveClass(/copied/);

    await image.click();

    await expect(image).toHaveClass(/copied/);
    const types = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap(item => item.types));
    expect(types).toContain('image/png');
    await expect(bubbles).toHaveCount(before);
  });

  test('clips an embedded image Ref instead when intercepting copy', async ({ page, context, request }) => {
    await setInterceptCopy(request, true);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const image = await embedImage(page, request);
    await page.evaluate(() => navigator.clipboard.writeText('unchanged'));
    const bubbles = page.locator('.clipboard-bubble');
    const before = await bubbles.count();

    await image.click();

    await expect(image).toHaveClass(/copied/);
    await expect(bubbles).toHaveCount(before + 1);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('unchanged');
    const bubble = bubbles.last();
    await expect(bubble.locator('.clipboard-preview')).toHaveAttribute('title', 'clip.png');
    await expect(bubble.locator('.clipboard-thumbnail-image')).toHaveCSS('background-image', /proxy/);
    await expect(bubble.locator('.clipboard-thumbnail-emoji')).toHaveCount(0);
    await bubble.locator('.clipboard-preview').click();
    await bubble.locator('.clipboard-clear').click();
    await expect(bubbles).toHaveCount(before);
    await setInterceptCopy(request, false);
  });
});
