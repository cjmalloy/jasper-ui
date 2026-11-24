import { type APIRequestContext, expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { adminHeaders, localOrigin, mod, test } from './setup';

test.describe.serial('Fullscreen Markdown', () => {
  const runId = Date.now().toString(36);
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  const imageRef = `comment:fs-image-${runId}`;
  const videoRef = `comment:fs-video-${runId}`;
  const viewports = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'narrow', width: 390, height: 844 },
  ];

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  async function cache(request: APIRequestContext, file: string, mime: string) {
    const res = await request.post(`${api}/proxy`, {
      headers: { ...await headers(request), 'Content-Type': mime },
      params: { title: `${file}-${runId}`, mime, origin: localOrigin() },
      data: readFileSync(`e2e/fixtures/${file}`),
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    return (await res.json()).url as string;
  }

  /** Ctrl+click the toggle, which opens the viewer fullscreen. */
  async function hotkeyFullscreen(page: Page, url: string) {
    await page.goto(`/ref/e/${encodeURIComponent(url)}?debug=USER`, { waitUntil: 'networkidle' });
    await page.keyboard.down('Control');
    await page.locator('.full-page.ref .toggle').first().click();
    await page.keyboard.up('Control');
    return fullscreenViewer(page);
  }

  async function fullscreenViewer(page: Page) {
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
    return page.locator('.embed:fullscreen');
  }

  async function box(el: Locator) {
    const b = await el.boundingBox();
    expect(b).toBeTruthy();
    return b!;
  }

  async function drag(page: Page, el: Locator, dx: number, dy: number) {
    const b = await box(el);
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
    await page.mouse.move(x + dx, y + dy, { steps: 4 });
    await page.mouse.up();
  }

  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-cache', '#mod-images', '[id="mod-plugin/video"]', '[id="mod-plugin/fullscreen"]');
  });

  test('create refs', async ({ request }) => {
    const image = await cache(request, 'wide.png', 'image/png');
    const video = await cache(request, 'test.webm', 'video/webm');
    for (const data of [
      { url: imageRef, title: 'Image', tags: ['public'], comment: `Text\n\n![wide](${image})` },
      { url: videoRef, title: 'Video', tags: ['public'], comment: `Text\n\n<video src="${video}"></video>` },
    ]) {
      const res = await request.post(`${api}/ref`, {
        headers: await headers(request),
        data: { ...data, origin: localOrigin() },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
  });

  for (const vp of viewports) {
    test(`fits images to the screen until resized (${vp.name})`, async ({ page }) => {
      await page.setViewportSize(vp);
      const viewer = await hotkeyFullscreen(page, imageRef);
      const image = viewer.locator('.md-container .image-expand.keep-ratio:not(.loading)');
      await expect(image).toBeVisible();
      const before = await box(image);
      expect(before.x).toBeGreaterThanOrEqual(-1);
      expect(before.x + before.width).toBeLessThanOrEqual(vp.width + 1);
      expect(before.height).toBeLessThanOrEqual(vp.height * 0.9 + 1);
      expect(before.width / before.height).toBeCloseTo(4, 1);

      await drag(page, image, 200, 50);
      await expect(image).toHaveClass(/\bresized\b/);
      const after = await box(image);
      expect(after.width).toBeGreaterThan(before.width);
      expect(after.width / after.height).toBeCloseTo(4, 1);
    });

    test(`fits video to the screen without jumping when resized (${vp.name})`, async ({ page }) => {
      await page.setViewportSize(vp);
      const viewer = await hotkeyFullscreen(page, videoRef);
      const video = viewer.locator('.md-container video.video-expand');
      await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth)).toBe(640);
      const before = await box(video);
      expect(before.x + before.width).toBeLessThanOrEqual(vp.width + 1);
      expect(before.width / before.height).toBeCloseTo(16 / 9, 1);
      const zoom = await video.evaluate(v => getComputedStyle(v).zoom);

      await drag(page, video, 20, 10);
      await expect(video).toHaveClass(/\bresized\b/);
      // The mobile zoom fix stays on, so a small drag only changes the size a little
      expect(await video.evaluate(v => getComputedStyle(v).zoom)).toBe(zoom);
      const after = await box(video);
      expect(Math.abs(after.width - before.width)).toBeLessThan(before.width * 0.25);
      expect(after.width / after.height).toBeCloseTo(16 / 9, 1);

      // The manual size wins over the mobile full width video rule
      await drag(page, video, -120, -60);
      const shrunk = await box(video);
      expect(shrunk.width).toBeLessThan(after.width * 0.9);
      expect(shrunk.width / shrunk.height).toBeCloseTo(16 / 9, 1);
    });
  }
});
