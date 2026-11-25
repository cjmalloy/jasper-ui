import { type APIRequestContext, expect, type Locator, type Page } from '@playwright/test';
import { adminHeaders, localOrigin, mod, test } from './setup';

/**
 * The lens "Responses Of:" / "Sources Of:" header stacks the label above the
 * target card when the column is too narrow to fit them side by side.
 */
test.describe.serial('Lens Header', () => {
  const runId = Date.now().toString(36);
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  const target = `comment:lens-target-${runId}`;
  const response = `comment:lens-response-${runId}`;
  const filters = [`responses/${target}`, `sources/${response}`];
  const titles: Record<string, string> = {
    [filters[0]]: 'Lens Target With A Fairly Long Title',
    [filters[1]]: 'Lens Response',
  };
  const stacked = [
    { width: 390, height: 844 },
    { width: 500, height: 844 },
  ];
  const sideBySide = [
    { width: 740, height: 844 },
    { width: 800, height: 844 },
    { width: 1280, height: 800 },
  ];

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  async function box(el: Locator) {
    const b = await el.boundingBox();
    expect(b).toBeTruthy();
    return b!;
  }

  async function header(page: Page, filter: string, scope: Locator = page.locator('body')) {
    const container = scope.locator(filter.startsWith('responses/') ? '.responses-of' : '.sources-of').first();
    await expect(container.locator('.info').first()).toBeVisible();
    return {
      container,
      label: container.locator('> .label'),
      card: container.locator('> .full-page'),
      info: container.locator('.info').first(),
      actions: container.locator('.actions').first(),
    };
  }

  async function expectInside(el: Locator, right: number) {
    const b = await box(el);
    expect(b.x + b.width).toBeLessThanOrEqual(right + 1);
  }

  async function expectStacked(page: Page, h: Awaited<ReturnType<typeof header>>, viewport: number, title: string) {
    const label = await box(h.label);
    const card = await box(h.card);
    const column = await box(h.container);
    expect(card.y).toBeGreaterThanOrEqual(label.y + label.height - 1);
    expect(card.width).toBeGreaterThan(column.width - 16);
    for (const el of [h.card, h.info, h.actions]) await expectInside(el, viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport);
    await expect(h.card.locator('.link').first()).toContainText(title);
  }

  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-root', '[id="mod-plugin/fullscreen"]');
  });

  test('create refs', async ({ request }) => {
    for (const data of [
      { url: target, title: 'Lens Target With A Fairly Long Title', tags: ['public', 'lens/test', 'lens/another'] },
      { url: response, title: 'Lens Response', tags: ['public', 'lens/test'], sources: [target] },
    ]) {
      const res = await request.post(`${api}/ref`, {
        headers: await headers(request),
        data: { ...data, origin: localOrigin() },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
  });

  for (const filter of filters) {
    for (const viewport of stacked) {
      test(`stacks ${filter.split('/')[0]} at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(`/tag/public?debug=USER&filter=${encodeURIComponent(filter)}`, { waitUntil: 'networkidle' });
        await expectStacked(page, await header(page, filter), viewport.width, titles[filter]);
      });
    }

    for (const viewport of sideBySide) {
      test(`keeps ${filter.split('/')[0]} side by side at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(`/tag/public?debug=USER&filter=${encodeURIComponent(filter)}`, { waitUntil: 'networkidle' });
        const h = await header(page, filter);
        const label = await box(h.label);
        const card = await box(h.card);
        expect(card.x).toBeGreaterThanOrEqual(label.x + label.width - 1);
        expect(Math.abs(card.y - label.y)).toBeLessThan(label.height);
        const column = await box(h.container);
        for (const el of [h.card, h.info, h.actions]) await expectInside(el, column.x + column.width);
      });
    }
  }

  test('stacks in phone fullscreen markdown', async ({ page, request }) => {
    const embed = `comment:lens-embed-${runId}`;
    const res = await request.post(`${api}/ref`, {
      headers: await headers(request),
      data: {
        url: embed,
        title: 'Lens Embed',
        tags: ['public'],
        comment: `Text\n\n![](/tag/public?filter=${encodeURIComponent(filters[0])})`,
        origin: localOrigin(),
      },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const viewport = stacked[0];
    await page.setViewportSize(viewport);
    await page.goto(`/ref/e/${encodeURIComponent(embed)}?debug=USER`, { waitUntil: 'networkidle' });
    await page.keyboard.down('Control');
    await page.locator('.full-page.ref .toggle').first().click();
    await page.keyboard.up('Control');
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
    // The lens shares the page query, so on a ref page the header shows responses of that ref
    await expectStacked(page, await header(page, filters[0], page.locator('.embed:fullscreen')), viewport.width, 'Lens Embed');
  });
});
