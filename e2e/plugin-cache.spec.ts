import { type APIRequestContext, expect } from '@playwright/test';
import { adminHeaders, localOrigin, mod, openSidebar, test } from './setup';

test.describe.serial('Cache Plugin', () => {
  const tag = 'cachefilter' + Date.now();
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  const filter = 'plugins->_plugin/cache->contentLength:num/after/';

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-cache');
  });

  test('create refs with cache sizes', async ({ request }) => {
    for (const [title, size] of [['Small', 2 * 1024], ['Medium', 2 * 1024 * 1024], ['Large', 20 * 1024 * 1024]] as const) {
      const res = await request.post(`${api}/ref`, {
        headers: await headers(request),
        data: {
          url: `comment:${tag}/${title}`,
          title,
          tags: ['public', tag, '_plugin/cache'],
          plugins: { '_plugin/cache': { contentLength: size } },
          origin: localOrigin(),
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
  });

  test('filters larger than a size', async ({ page }) => {
    const request = page.waitForRequest(req => req.url().includes('/api/v1/ref/page') && req.url().includes('filterAfter'));
    await page.goto(`/tag/${tag}?debug=ADMIN&sort=plugins->_plugin/cache->contentLength:num,ASC&filter=${filter}1mb`, { waitUntil: 'networkidle' });
    expect(new URL((await request).url()).searchParams.getAll('filterAfter')).toEqual(['plugins->_plugin/cache->contentLength:num/' + 1024 * 1024]);
    const links = page.locator('.ref-list-item .link a');
    await expect(links).toHaveText(['Medium', 'Large']);
    await openSidebar(page);
    await expect(page.locator('.filter .filter-range')).toBeVisible();
    await expect(page.locator('.filter .filter-range-label')).toHaveText('1 MB');
  });

  test('shows the number and unit while the hotkey is held', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=ADMIN&sort=plugins->_plugin/cache->contentLength:num,ASC&filter=${filter}1mb`, { waitUntil: 'networkidle' });
    await openSidebar(page);
    const filterBox = page.locator('.filter').first();
    const width = (await filterBox.boundingBox())!.width;
    await page.keyboard.down('Control');
    await expect(page.locator('.filter .filter-value')).toHaveValue('1');
    await expect(page.locator('.filter .filter-unit')).toHaveValue('mb');
    await expect(page.locator('.filter .filter-range-label')).toHaveText('1 MB');
    expect((await filterBox.boundingBox())!.width).toBe(width);
    await page.keyboard.up('Control');
    await expect(page.locator('.filter .filter-range')).toBeVisible();
    expect((await filterBox.boundingBox())!.width).toBe(width);
  });

  test('changes the unit', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=ADMIN&sort=plugins->_plugin/cache->contentLength:num,ASC&filter=${filter}1mb`, { waitUntil: 'networkidle' });
    await openSidebar(page);
    await page.keyboard.down('Control');
    await page.locator('.filter .filter-unit').focus();
    await page.keyboard.up('Control');
    await page.locator('.filter .filter-unit').selectOption('kb');
    await expect(page.locator('.ref-list-item .link a')).toHaveText(['Small', 'Medium', 'Large']);
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual([filter + '1kb']);
  });

  test('picks the unit from shorthand', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=ADMIN&sort=plugins->_plugin/cache->contentLength:num,ASC&filter=${filter}1mb`, { waitUntil: 'networkidle' });
    await openSidebar(page);
    const value = page.locator('.filter .filter-value');
    await page.keyboard.down('Control');
    await value.focus();
    await page.keyboard.up('Control');
    await value.fill('15 KB');
    await value.press('Enter');
    await expect(value).toHaveValue('15');
    await expect(page.locator('.filter .filter-unit')).toHaveValue('kb');
    await expect(page.locator('.ref-list-item .link a')).toHaveText(['Medium', 'Large']);
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual([filter + '15kb']);

    await value.fill('5');
    await value.press('Enter');
    await expect(page.locator('.ref-list-item .link a')).toHaveText(['Medium', 'Large']);
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual([filter + '5kb']);

    await value.fill('big');
    await value.press('Enter');
    await expect(value).toHaveValue('5');
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual([filter + '5kb']);
  });

  test('adds the filter from the menu', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=ADMIN&sort=plugins->_plugin/cache->contentLength:num,ASC`, { waitUntil: 'networkidle' });
    await openSidebar(page);
    await page.locator('.filter select.big').selectOption({ label: '🗜️ larger than' });
    await expect(page.locator('.filter .filter-range-label')).toHaveText('10 MB');
    await expect(page.locator('.ref-list-item .link a')).toHaveText(['Large']);
  });

  test('fine tunes while dragging with the hotkey', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=ADMIN&sort=plugins->_plugin/cache->contentLength:num,ASC&filter=${filter}1mb`, { waitUntil: 'networkidle' });
    await openSidebar(page);
    const range = page.locator('.filter .filter-range');
    const label = page.locator('.filter .filter-range-label');
    await expect(label).toHaveText('1 MB');
    const max = Number(await range.getAttribute('max'));
    const box = (await range.boundingBox())!;
    // Chrome's default thumb is 16px wide
    const x = (index: number) => box.x + 8 + (box.width - 16) * index / max;
    const y = box.y + box.height / 2;
    const stops = ['1 MB', '5 MB'];

    await page.mouse.move(x(3), y);
    await page.mouse.down();
    await page.keyboard.down('Control');
    await page.mouse.move(x(3.5), y, { steps: 5 });
    const fine = (await label.textContent())!;
    expect(stops).not.toContain(fine);

    // Releasing the hotkey keeps the fine value
    await page.keyboard.up('Control');
    await expect(label).toHaveText(fine);

    // Pressing it again resumes fine tuning
    await page.keyboard.down('Control');
    await expect(range).toBeVisible();
    await expect(page.locator('.filter .filter-value')).toHaveCount(0);
    await page.mouse.move(x(3.6), y, { steps: 5 });
    const finer = (await label.textContent())!;
    expect([...stops, fine]).not.toContain(finer);
    await page.keyboard.up('Control');
    await page.mouse.up();
    await expect(label).toHaveText(finer);
    await expect.poll(() => new URL(page.url()).searchParams.getAll('filter')[0]).not.toMatch(/\/(1|5)mb$/);
    expect(new URL(page.url()).searchParams.getAll('filter')[0]).toMatch(/^plugins->_plugin\/cache->contentLength:num\/after\/\d+$/);

    // The next drag snaps to stops again
    await page.mouse.move(x(3.6), y);
    await page.mouse.down();
    await page.mouse.move(x(3), y, { steps: 5 });
    await expect(label).toHaveText('1 MB');
    await page.mouse.up();
    await expect.poll(() => new URL(page.url()).searchParams.getAll('filter')).toEqual([filter + '1mb']);
  });
});
