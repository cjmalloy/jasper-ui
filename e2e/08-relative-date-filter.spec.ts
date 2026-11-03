import { type APIRequestContext, expect } from '@playwright/test';
import { adminHeaders, localOrigin, openSidebar, test } from './setup';

test.describe.serial('Relative date filter', () => {
  const tag = 'relativedate' + Date.now();
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  test('create refs with published dates', async ({ request }) => {
    for (const [title, days] of [['Recent', 2], ['Old', 30]] as const) {
      const res = await request.post(`${api}/ref`, {
        headers: await headers(request),
        data: {
          url: `comment:${tag}/${title}`,
          title,
          tags: ['public', tag],
          published: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
          origin: localOrigin(),
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
  });

  test('slides a relative date filter', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=USER&sort=published&filter=published/after/P7D`, { waitUntil: 'networkidle' });
    const links = page.locator('.ref-list-item .link a');
    await expect(links).toHaveText(['Recent']);
    await openSidebar(page);
    await expect(page.locator('.filter input[type="datetime-local"]')).toHaveCount(0);
    await expect(page.locator('.filter .relative-date-label')).toHaveText('7 days ago');

    await page.locator('.filter .relative-date-range').press('End');
    await expect(page.locator('.filter .relative-date-label')).toHaveText('100 years ago');
    await expect(links).toHaveText(['Recent', 'Old']);
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual(['published/after/P100Y']);
  });

  test('hotkey switches a date to a relative date', async ({ page }) => {
    const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    await page.goto(`/tag/${tag}?debug=USER&sort=published&filter=published/after/${date}`, { waitUntil: 'networkidle' });
    const links = page.locator('.ref-list-item .link a');
    await expect(links).toHaveText(['Recent', 'Old']);
    await openSidebar(page);
    await expect(page.locator('.filter input[type="datetime-local"]')).toBeVisible();
    await expect(page.locator('.filter .relative-date-range')).toHaveCount(0);

    const label = page.locator('.filter .relative-date-label');
    await expect(label).toHaveCount(0);

    await page.keyboard.down('Control');
    const range = page.locator('.filter .relative-date-range');
    await expect(range).toBeVisible();
    await expect(label).toHaveCount(0);
    // P7D
    await range.fill('7');
    await page.keyboard.up('Control');
    await expect(range).toBeVisible();
    await expect(page.locator('.filter .relative-date-label')).toHaveText('7 days ago');
    await expect(links).toHaveText(['Recent']);
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual(['published/after/P7D']);
  });

  test('hotkey switches a relative date to a date', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=USER&sort=published&filter=published/after/P7D`, { waitUntil: 'networkidle' });
    const links = page.locator('.ref-list-item .link a');
    await expect(links).toHaveText(['Recent']);
    await openSidebar(page);
    await expect(page.locator('.filter .relative-date-range')).toBeVisible();

    await page.keyboard.down('Control');
    const date = page.locator('.filter input[type="datetime-local"]');
    await expect(date).toBeVisible();
    await expect(page.locator('.filter .relative-date-range')).toHaveCount(0);
    await expect(page.locator('.filter .relative-date-label')).toHaveText('7 days ago');
    await date.focus();
    await page.keyboard.up('Control');
    await expect(date).toBeVisible();
    await date.fill('2000-01-01T00:00');
    await date.press('Enter');
    await expect(links).toHaveText(['Recent', 'Old']);
    const [filter] = new URL(page.url()).searchParams.getAll('filter');
    expect(filter).toMatch(/^published\/after\/2000-01-01T00:00/);
    await expect(date).toBeVisible();
    await expect(page.locator('.filter .relative-date-range')).toHaveCount(0);
  });

  test('hotkey slides a date to now', async ({ page }) => {
    const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    await page.goto(`/tag/${tag}?debug=USER&sort=published&filter=published/before/${date}`, { waitUntil: 'networkidle' });
    const links = page.locator('.ref-list-item .link a');
    await expect(links).toHaveText([]);
    await openSidebar(page);
    await page.keyboard.down('Control');
    const range = page.locator('.filter .relative-date-range');
    await expect(range).toBeVisible();
    const box = (await range.boundingBox())!;
    await page.mouse.move(box.x + box.width * 6 / 12, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 20, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up('Control');
    await expect(page.locator('.filter .relative-date-label')).toHaveText('now');
    await expect(links).toHaveText(['Recent', 'Old']);
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual(['published/before/now']);
  });

  test('hotkey switches a focused date to a relative date', async ({ page }) => {
    const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    await page.goto(`/tag/${tag}?debug=USER&sort=published&filter=published/after/${date}`, { waitUntil: 'networkidle' });
    await openSidebar(page);
    const input = page.locator('.filter input[type="datetime-local"]');
    await input.fill('2000-01-01T00:00');
    await input.press('Enter');
    await expect(input).toBeFocused();
    await page.keyboard.down('Control');
    await expect(page.locator('.filter .relative-date-range')).toBeVisible();
    await page.keyboard.up('Control');
    await expect(input).toBeVisible();
  });

  test('hotkey slides a new date to now', async ({ page }) => {
    const date = new Date(Date.now() - 5 * 1000).toISOString();
    await page.goto(`/tag/${tag}?debug=USER&sort=published&filter=published/before/${date}`, { waitUntil: 'networkidle' });
    const links = page.locator('.ref-list-item .link a');
    await expect(links).toHaveText(['Recent', 'Old']);
    await openSidebar(page);
    await page.keyboard.down('Control');
    const range = page.locator('.filter .relative-date-range');
    await expect(range).toBeVisible();
    await expect(range).toHaveValue('0');
    const box = (await range.boundingBox())!;
    await page.mouse.move(box.x + 8, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 20, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up('Control');
    await expect(page.locator('.filter .relative-date-label')).toHaveText('now');
    await expect.poll(() => new URL(page.url()).searchParams.getAll('filter')).toEqual(['published/before/now']);
  });
});
