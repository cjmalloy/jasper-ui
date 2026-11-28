import { type APIRequestContext, expect } from '@playwright/test';
import { adminHeaders, localOrigin, mod, test } from './setup';

test.describe.serial('Guitar Tab Plugin', () => {
  const url = 'comment:tab' + Date.now();
  const sheetUrl = 'comment:chords' + Date.now();
  const sheet = [
    '[Chorus]',
    '      D      G       Em  Am         D          G      Em  Am',
    "On an island in the sun, we'll be playing and having fun",
  ].join('\n');
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  const bar = '-0---2---3---5---|';
  const tab = [
    '[Verse]',
    '  Am                C                 G                 D',
    'G|' + bar.repeat(4),
    'D|' + bar.repeat(4),
    'A|' + bar.repeat(4),
    'E|' + bar.repeat(4),
    '  one               two               three             four',
  ].join('\n');

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-guitartab');
  });

  test('create tab', async ({ request }) => {
    const res = await request.post(`${api}/ref`, {
      headers: await headers(request),
      data: { url, title: 'Bass Tab', comment: tab, tags: ['public', 'plugin/tab'], origin: localOrigin() },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const sheetRes = await request.post(`${api}/ref`, {
      headers: await headers(request),
      data: { url: sheetUrl, title: 'Chord Sheet', comment: sheet, tags: ['public', 'plugin/tab'], origin: localOrigin() },
    });
    expect(sheetRes.ok(), await sheetRes.text()).toBeTruthy();
  });

  test('renders bars on one line when they fit', async ({ page }) => {
    await page.goto(`/ref/e/${encodeURIComponent(url)}?debug=USER`, { waitUntil: 'networkidle' });
    const tabEl = page.locator('.guitar-tab');
    await expect(tabEl.locator('.tab-text .tab-line')).toHaveText('[Verse]');
    const bars = tabEl.locator('.tab-bar');
    await expect(bars).toHaveCount(4);
    await expect(bars.first().locator('.string')).toHaveCount(4);
    await expect(bars.first().locator('.chord')).toHaveText('Am');
    await expect(bars.nth(2).locator('.text')).toHaveText('three');
    const tops = await bars.evaluateAll(els => els.map(e => e.getBoundingClientRect().top));
    expect(new Set(tops).size).toBe(1);
  });

  test('reflows bars to fit a narrow screen', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 720 });
    await page.goto(`/ref/e/${encodeURIComponent(url)}?debug=USER`, { waitUntil: 'networkidle' });
    const bars = page.locator('.guitar-tab .tab-bar');
    await expect(bars).toHaveCount(4);
    const system = await page.locator('.guitar-tab .tab-system').boundingBox();
    const boxes = await bars.evaluateAll(els => els.map(e => e.getBoundingClientRect().toJSON()));
    expect(new Set(boxes.map(b => b.top)).size).toBeGreaterThan(1);
    for (const b of boxes) expect(b.right).toBeLessThanOrEqual(system!.x + system!.width);
    // String names are repeated beside each wrapped row
    const secondRow = boxes.findIndex(b => b.top > boxes[0].top);
    const label = page.locator('.guitar-tab .tab-stack').nth(1).locator('.string').first();
    await expect(label).toHaveText('G|');
    const string = bars.nth(secondRow).locator('.string').first();
    expect(Math.abs((await label.boundingBox())!.y - (await string.boundingBox())!.y)).toBeLessThan(1);
  });

  test('reflows chords with their lyrics', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 720 });
    await page.goto(`/ref/e/${encodeURIComponent(sheetUrl)}?debug=USER`, { waitUntil: 'networkidle' });
    const tabEl = page.locator('.guitar-tab');
    await expect(tabEl.locator('.header')).toHaveText('[Chorus]');
    const chunks = tabEl.locator('.tab-chords .tab-chunk');
    const island = chunks.filter({ hasText: 'island' });
    await expect(island.locator('.chord')).toHaveText('D');
    await expect(island.locator('.text')).toHaveText('island ');
    const boxes = await chunks.evaluateAll(els => els.map(e => e.getBoundingClientRect().toJSON()));
    expect(new Set(boxes.map(b => b.top)).size).toBeGreaterThan(1);
    const block = (await tabEl.locator('.tab-chords').boundingBox())!;
    for (const b of boxes) expect(b.right).toBeLessThanOrEqual(block.x + block.width + 0.5);
  });
});
