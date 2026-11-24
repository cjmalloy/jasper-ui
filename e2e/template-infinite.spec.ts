import { type APIRequestContext, expect } from '@playwright/test';
import { deflateSync } from 'node:zlib';
import { adminHeaders, localOrigin, mod, test } from './setup';

function crc32(data: Buffer) {
  let crc = ~0;
  for (const byte of data) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function png(width: number, height: number, rgb: [number, number, number]) {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(width).fill(rgb).flat())]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(Array(height).fill(row)))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

test.describe.serial('Infinite scroll', () => {
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  const pageSize = 6;
  const total = 10;

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-cache', '#mod-images');
  });

  test('upload images', async ({ request }) => {
    const origin = localOrigin();
    for (let i = 0; i < total; i++) {
      // Tall images so a page is much taller than the viewport
      const upload = await request.post(`${api}/proxy`, {
        headers: { ...await headers(request), 'Content-Type': 'image/png' },
        params: { title: `infinite-${i}.png`, mime: 'image/png', origin },
        data: png(10, 40, [20 * i, 100, 200]),
      });
      expect(upload.ok()).toBeTruthy();
      const { url } = await upload.json();
      const tagged = await request.patch(`${api}/tags`, {
        headers: await headers(request),
        params: { url, origin, tags: ['public', 'plugin/image'] },
      });
      expect(tagged.ok()).toBeTruthy();
    }
  });

  test('loads the next image page when scrolled to the bottom', async ({ page }) => {
    await page.goto(`/tag/plugin/image?debug=ADMIN&pageSize=${pageSize}`, { waitUntil: 'networkidle' });
    const refs = page.locator('.list-container > .ref');
    await expect(refs).toHaveCount(pageSize);
    await expect(page.locator('.infinite-scroll-sentinel')).toBeAttached();

    await page.locator('.infinite-scroll').scrollIntoViewIfNeeded();
    await expect(refs).toHaveCount(total);
    await expect(page.locator('.infinite-scroll-sentinel')).toHaveCount(0);
    await expect(page.locator('.infinite-scroll')).toBeAttached();
    await expect(page.locator('.page-controls .next-page')).toHaveCount(0);
    await expect(page.locator('.infinite-controls select')).toBeVisible();
  });

  test('pages a plain tag unless infinite=true', async ({ page, request }) => {
    const origin = localOrigin();
    const tag = 'infinitetest';
    for (let i = 0; i < total; i++) {
      const created = await request.post(`${api}/ref`, {
        headers: await headers(request),
        data: { url: `comment:infinite-${i}`, origin, title: `Infinite ${i}`, tags: ['public', tag] },
      });
      expect(created.ok()).toBeTruthy();
    }
    await page.goto(`/tag/${tag}?debug=ADMIN&pageSize=${pageSize}`, { waitUntil: 'networkidle' });
    const refs = page.locator('.list-container > .ref');
    await expect(refs).toHaveCount(pageSize);
    await expect(page.locator('.page-controls .next-page')).not.toHaveClass(/disabled/);
    await expect(page.locator('.infinite-scroll-sentinel')).toHaveCount(0);

    await page.goto(`/tag/${tag}?debug=ADMIN&pageSize=${pageSize}&infinite=true`, { waitUntil: 'networkidle' });
    await expect(refs.first()).toBeVisible();
    await page.locator('.infinite-scroll').scrollIntoViewIfNeeded();
    await expect(refs).toHaveCount(total);
    await expect(page.locator('.infinite-scroll-sentinel')).toHaveCount(0);
    await expect(page.locator('.page-controls .next-page')).toHaveCount(0);
  });

  test('infinite=false query param restores paging', async ({ page }) => {
    await page.goto(`/tag/plugin/image?debug=ADMIN&pageSize=${pageSize}&infinite=false`, { waitUntil: 'networkidle' });
    const refs = page.locator('.list-container > .ref');
    await expect(refs).toHaveCount(pageSize);
    await expect(page.locator('.infinite-scroll-sentinel')).toHaveCount(0);
    await expect(page.locator('.infinite-controls')).toHaveCount(0);
    await expect(page.locator('.page-controls .next-page')).not.toHaveClass(/disabled/);
  });
});
