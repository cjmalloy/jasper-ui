import { type APIRequestContext, expect, type Page } from '@playwright/test';
import { adminHeaders, localOrigin, mod, openSidebar, test } from './setup';

test.describe.serial('Duration Plugin', () => {
  const tag = 'durationfilter' + Date.now();
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  const seconds: Record<string, number> = { pt2m: 120, pt5m: 300, pt10m: 600, pt30m: 1800, pt1h: 3600, pt2h: 7200 };
  const tagFilters: string[][] = [];

  /**
   * Apply tagBefore/tagAfter to the real response, so the client is tested
   * even if the server does not support value filters yet.
   */
  async function routeTagFilters(page: Page) {
    await page.route('**/api/v1/ref/page**', async route => {
      const url = new URL(route.request().url());
      const before = url.searchParams.getAll('tagBefore');
      const after = url.searchParams.getAll('tagAfter');
      if (!url.searchParams.get('query')?.includes(tag) || !before.length && !after.length) {
        await route.fallback();
        return;
      }
      tagFilters.push([...before.map(b => 'before/' + b), ...after.map(a => 'after/' + a)]);
      url.searchParams.delete('tagBefore');
      url.searchParams.delete('tagAfter');
      const response = await route.fetch({ url: url.toString() });
      const json = await response.json();
      const value = (f: string) => seconds[f.substring(f.lastIndexOf('/') + 1)];
      json.content = json.content.filter((ref: { url: string }) => {
        const duration = value(ref.url);
        return before.every(b => duration < value(b)) && after.every(a => duration > value(a));
      });
      await route.fulfill({ response, json });
    });
  }

  test('enable mods', async ({ page }) => {
    await mod(page, '[id="mod-plugin/duration"]');
  });

  test('create refs with durations', async ({ request }) => {
    for (const [title, duration] of [['Short', 'pt2m'], ['Medium', 'pt30m'], ['Long', 'pt2h']]) {
      const res = await request.post(`${api}/ref`, {
        headers: await headers(request),
        data: {
          url: `comment:${tag}/${duration}`,
          title,
          tags: ['public', tag, `plugin/duration/${duration}`],
          origin: localOrigin(),
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
  });

  test('filters shorter than a duration', async ({ page }) => {
    await routeTagFilters(page);
    await page.goto(`/tag/${tag}?debug=USER&sort=tags->plugin/duration:dur`, { waitUntil: 'networkidle' });
    const links = page.locator('.ref-list-item .link a');
    await expect(links).toHaveText(['Short', 'Medium', 'Long']);
    await openSidebar(page);
    await page.locator('.filter select.big').selectOption({ label: '⏱️ shorter than' });
    const value = page.locator('.filter .filter-value');
    await expect(value).toHaveValue('pt5m');
    await expect(links).toHaveText(['Short']);

    await value.fill('pt1h');
    await value.press('Enter');
    await expect(links).toHaveText(['Short', 'Medium']);
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual(['before/tags->plugin/duration:dur/pt1h']);
    expect(tagFilters.at(-1)).toEqual(['before/tags->plugin/duration:dur/pt1h']);
  });

  test('filters longer than a duration', async ({ page }) => {
    await routeTagFilters(page);
    await page.goto(`/tag/${tag}?debug=USER&sort=tags->plugin/duration:dur&filter=after/tags->plugin/duration:dur/PT10M`, { waitUntil: 'networkidle' });
    await expect(page.locator('.ref-list-item .link a')).toHaveText(['Medium', 'Long']);
    expect(tagFilters.at(-1)).toEqual(['after/tags->plugin/duration:dur/pt10m']);
  });
});
