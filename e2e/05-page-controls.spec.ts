import { expect, test } from '@playwright/test';

const dateSorts = ['published', 'created'] as const;

for (const field of dateSorts) {
  test(`secretly cursor-pages duplicate ${field} dates`, async ({ page }) => {
    const date = '2024-01-02T00:00:00.000Z';
    const first = ref(`${field}-first`, `${field} first`, date, '2024-01-01T00:00:00.000Z');
    const anchor = ref(`${field}-anchor`, `${field} anchor`, date, '2024-01-01T00:00:00.001Z');
    const next = ref(`${field}-next`, `${field} next`, date, '2024-01-01T00:00:00.002Z');
    const older = ref(`${field}-older`, `${field} older`, '2024-01-01T00:00:00.000Z');
    const cursorRequests: URL[] = [];

    await page.route('**/api/v1/ref/page**', async route => {
      const url = new URL(route.request().url());
      if (url.searchParams.getAll('sort')[0] !== `${field},DESC`) {
        await route.fallback();
        return;
      }
      if (url.searchParams.has(`${field}Before`)) {
        cursorRequests.push(url);
        await route.fulfill({
          json: refPage([first, anchor, next, older], 0, Number(url.searchParams.get('size')), 4),
        });
        return;
      }
      if (url.searchParams.get('page') === '1') {
        await route.fulfill({ json: refPage([anchor, next], 1, 2, 4) });
        return;
      }
      await route.fulfill({ json: refPage([first, anchor], 0, 2, 4) });
    });

    await page.goto(`/tag/public?debug=ADMIN&view=list&sort=${field},DESC&pageSize=2&pageNumber=0`);
    const links = page.locator('.ref-list-item .link a');
    await expect(links).toHaveText([`${field} first`, `${field} anchor`]);
    const firstPage = await links.allTextContents();

    await page.locator('.next-page').click();

    await expect.poll(() => cursorRequests.length).toBe(1);
    await expect(links).toHaveText([
      `${field} next`,
      `${field} older`,
    ]);
    expect([...firstPage, ...await links.allTextContents()]).toEqual([
      `${field} first`,
      `${field} anchor`,
      `${field} next`,
      `${field} older`,
    ]);
    expect(cursorRequests[0].searchParams.has('page')).toBe(false);
    expect(Number(cursorRequests[0].searchParams.get('size'))).toBeGreaterThan(2);
    expect(page.url()).toContain('pageNumber=1');
    expect(page.url()).not.toContain(`${field}Before`);
  });
}

function ref(slug: string, title: string, date: string, modified = date) {
  return {
    url: `https://example.com/${slug}`,
    origin: '',
    title,
    tags: ['public'],
    published: date,
    created: date,
    modified,
  };
}

function refPage(content: ReturnType<typeof ref>[], number: number, size: number, totalElements: number) {
  return {
    content,
    page: {
      number,
      size,
      totalElements,
      totalPages: Math.ceil(totalElements / size),
    },
  };
}
