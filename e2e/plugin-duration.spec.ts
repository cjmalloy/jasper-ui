import { type APIRequestContext, expect } from '@playwright/test';
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

  test('enable mods', async ({ page }) => {
    await mod(page, '[id="mod-plugin/duration"]');
  });

  test('create refs with durations', async ({ request }) => {
    for (const [title, duration, t] of [['Short', 'pt2m', tag], ['Medium', 'pt30m', tag], ['Long', 'pt2h', tag], ['Other', 'pt10h', tag + 'other']]) {
      const res = await request.post(`${api}/ref`, {
        headers: await headers(request),
        data: {
          url: `comment:${t}/${duration}`,
          title,
          tags: ['public', t, `plugin/duration/${duration}`],
          origin: localOrigin(),
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
  });

  test('filters shorter than a duration', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=USER&sort=tags->plugin/duration:dur`, { waitUntil: 'networkidle' });
    const links = page.locator('.ref-list-item .link a');
    await expect(links).toHaveText(['Short', 'Medium', 'Long']);
    await openSidebar(page);
    await page.locator('.filter select.big').selectOption({ label: '⏱️ shorter than' });
    const range = page.locator('.filter .filter-range');
    await expect(page.locator('.filter .filter-range-label')).toHaveText('5 min');
    await expect(links).toHaveText(['Short']);
    // Stops from 2 min to 2 hr, the shortest and longest durations on this tag
    await expect(range).toHaveAttribute('max', '8');

    await range.press('End');
    await expect(page.locator('.filter .filter-range-label')).toHaveText('2 hr');
    await expect(links).toHaveText(['Short', 'Medium']);
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual(['tags->plugin/duration:dur/before/pt2h']);
  });

  test('keeps the value when switching to longer than', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=USER&sort=tags->plugin/duration:dur&filter=tags->plugin/duration:dur/before/pt10m`, { waitUntil: 'networkidle' });
    const links = page.locator('.ref-list-item .link a');
    await expect(links).toHaveText(['Short']);
    await openSidebar(page);
    await page.locator('.filter #filter-0').selectOption({ label: '⏱️ longer than' });
    await expect(page.locator('.filter .filter-range-label')).toHaveText('10 min');
    await expect(links).toHaveText(['Medium', 'Long']);
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual(['tags->plugin/duration:dur/after/pt10m']);
  });

  test('reads shorthand from the URL', async ({ page }) => {
    const request = page.waitForRequest(req => req.url().includes('/api/v1/ref/page') && req.url().includes('filter='));
    await page.goto(`/tag/${tag}?debug=USER&sort=tags->plugin/duration:dur&filter=tags->plugin/duration:dur/before/45m`, { waitUntil: 'networkidle' });
    expect(new URL((await request).url()).searchParams.getAll('filter')).toEqual(['tags->plugin/duration:dur/before/pt45m']);
    await expect(page.locator('.ref-list-item .link a')).toHaveText(['Short', 'Medium']);
    await openSidebar(page);
    await expect(page.locator('.filter .filter-range-label')).toHaveText('45 min');
  });

  test('types an ISO duration with the hotkey', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=USER&sort=tags->plugin/duration:dur&filter=tags->plugin/duration:dur/before/pt10m`, { waitUntil: 'networkidle' });
    const links = page.locator('.ref-list-item .link a');
    await expect(links).toHaveText(['Short']);
    await openSidebar(page);
    const text = page.locator('.filter .filter-value');
    await expect(text).toHaveCount(0);

    await page.keyboard.down('Control');
    await expect(text).toHaveValue('pt10m');
    await text.click();
    await page.keyboard.up('Control');
    await text.fill('PT1H30M');
    await text.press('Enter');
    await expect(links).toHaveText(['Short', 'Medium']);
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual(['tags->plugin/duration:dur/before/PT1H30M']);
    await expect(text).toHaveCount(0);
    await expect(page.locator('.filter .filter-range-label')).toHaveText('1 hr, 30 min');
  });

  test('drags between stops with the hotkey', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=USER&sort=tags->plugin/duration:dur&filter=tags->plugin/duration:dur/before/pt10m`, { waitUntil: 'networkidle' });
    await openSidebar(page);
    const range = page.locator('.filter .filter-range');
    await expect(page.locator('.filter .filter-range-label')).toHaveText('10 min');
    const box = (await range.boundingBox())!;
    const max = Number(await range.getAttribute('max'));
    const value = Number(await range.inputValue());
    const x = box.x + 8 + (box.width - 16) * value / max;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.keyboard.down('Control');
    // A third of a stop, which would snap back to 10 min
    await page.mouse.move(x + (box.width - 16) / max / 3, y, { steps: 4 });
    await page.mouse.up();
    await page.keyboard.up('Control');
    await expect(page.locator('.filter .filter-range-label')).not.toHaveText('10 min');
    await expect.poll(() => new URL(page.url()).searchParams.get('filter')).toMatch(/^tags->plugin\/duration:dur\/before\/pt1\dm(\d+s)?$/);
  });

  test('filters longer than a duration', async ({ page }) => {
    const request = page.waitForRequest(req => req.url().includes('/api/v1/ref/page') && req.url().includes('filter='));
    await page.goto(`/tag/${tag}?debug=USER&sort=tags->plugin/duration:dur&filter=tags->plugin/duration:dur/after/PT10M`, { waitUntil: 'networkidle' });
    expect(new URL((await request).url()).searchParams.getAll('filter')).toEqual(['tags->plugin/duration:dur/after/pt10m']);
    await expect(page.locator('.ref-list-item .link a')).toHaveText(['Medium', 'Long']);
  });
});
