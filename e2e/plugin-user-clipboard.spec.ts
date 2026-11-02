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

  async function cacheImage(page: Page, request: APIRequestContext) {
    await page.goto('/?debug=ADMIN');
    const png = Buffer.from(await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      canvas.getContext('2d')!.fillRect(0, 0, 64, 64);
      return canvas.toDataURL('image/png').split(',')[1];
    }), 'base64');
    const res = await request.post(`${api}/proxy`, {
      headers: { ...await headers(request), 'Content-Type': 'image/png' },
      params: { title: 'clip.png', mime: 'image/png', origin: localOrigin() },
      data: png,
    });
    expect(res.ok(), await res.text()).toBe(true);
    return (await res.json()).url as string;
  }

  async function embedImage(page: Page, request: APIRequestContext) {
    const url = await cacheImage(page, request);
    await page.addInitScript(() => {
      const w = window as any;
      w.e2eVibrations = [];
      w.e2eWiggles = [];
      Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (pattern: VibratePattern) => w.e2eVibrations.push(pattern) });
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (keyframes: any, options: any) {
        if (this.classList.contains('image-expand')) w.e2eWiggles.push({ keyframes, options });
        return animate.call(this, keyframes, options);
      };
    });
    await page.goto('/submit/text?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.setItem('showPreview', 'true'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.editor textarea:not(.measurer)').fill(`![](${url})`);
    const image = page.locator('.editor .md .embed .image-expand');
    await expect(image).not.toHaveClass(/loading/);
    return image;
  }

  async function copyFeedback(page: Page) {
    return page.evaluate(() => {
      const w = window as any;
      return {
        vibrations: w.e2eVibrations.length as number,
        wiggles: (w.e2eWiggles as any[]).map(({ keyframes, options }) => {
          const angles = keyframes.map((k: any) => Number(/rotate\((-?[\d.e-]+)rad\)/.exec(k.transform)![1]));
          const angle = Math.max(...angles.map(Math.abs));
          return { duration: options.duration as number, angle, turns: angles.map((a: number) => Math.sign(a) || 0) };
        }),
      };
    });
  }

  test('copies an embedded image to the system clipboard on click', async ({ page, context, request }) => {
    await setInterceptCopy(request, false);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const image = await embedImage(page, request);
    const bubbles = page.locator('.clipboard-bubble');
    const before = await bubbles.count();

    const box = (await image.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 40, { steps: 5 });
    await page.mouse.up();
    expect((await image.boundingBox())!.width).toBeGreaterThan(box.width + 20);
    expect(await copyFeedback(page)).toEqual({ vibrations: 0, wiggles: [] });

    await image.click();

    await expect.poll(() => copyFeedback(page)).toMatchObject({ vibrations: 1, wiggles: [{ duration: 400 }] });
    const { wiggles: [wiggle] } = await copyFeedback(page);
    const box2 = (await image.boundingBox())!;
    const corner = Math.hypot(box2.width, box2.height) / 2 * wiggle.angle;
    expect(corner).toBeGreaterThan(1.5);
    expect(corner).toBeLessThan(2.5);
    expect(wiggle.turns).toEqual([0, -1, 1, -1, 0]);
    const types = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap(item => item.types));
    expect(types).toContain('image/png');
    await expect(bubbles).toHaveCount(before);

    await page.evaluate(() => navigator.clipboard.writeText('unchanged'));
    await image.locator('..').focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => copyFeedback(page)).toMatchObject({ vibrations: 2 });
    await expect.poll(async () => page.evaluate(async () => (await navigator.clipboard.read()).flatMap(item => item.types)))
      .toContain('image/png');
  });

  test('clips an embedded image Ref instead when intercepting copy', async ({ page, context, request }) => {
    await setInterceptCopy(request, true);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const image = await embedImage(page, request);
    await page.evaluate(() => navigator.clipboard.writeText('unchanged'));
    const bubbles = page.locator('.clipboard-bubble');
    const before = await bubbles.count();

    await image.click();

    await expect.poll(() => copyFeedback(page)).toMatchObject({ vibrations: 1, wiggles: [{ duration: 400 }] });
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
