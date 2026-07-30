import { expect, test } from '@playwright/test';

const dateSorts = ['published', 'created', 'modified'] as const;

for (const field of dateSorts) {
  test(`uses one stable request per page for duplicate ${field} dates`, async ({ page }) => {
    const date = '2024-01-02T00:00:00.000Z';
    const modified = field === 'modified' ? date : '2024-01-01T00:00:00.000Z';
    const first = ref(`${field}-first`, `${field} first`, date, modified, '@a');
    const anchor = ref(`${field}-anchor`, `${field} anchor`, date, modified, '@b');
    const next = ref(
      `${field}-next`,
      `${field} next`,
      date,
      field === 'modified' ? modified : '2024-01-01T00:00:00.001Z',
      field === 'modified' ? '@c' : '@a',
    );
    const older = ref(`${field}-older`, `${field} older`, '2024-01-01T00:00:00.000Z', undefined, '@a');
    const stableSort = [
      `${field},DESC`,
      ...(field === 'modified' ? [] : ['modified,ASC']),
      'origin,ASC',
    ];
    const offsetRequests: URL[] = [];
    const cursorRequests: URL[] = [];

    await page.route('**/api/v1/ref/page**', async route => {
      const url = new URL(route.request().url());
      const sort = url.searchParams.getAll('sort');
      if (sort[0] !== `${field},DESC`) {
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
      offsetRequests.push(url);
      const stable = stableSort.every((value, index) => sort[index] === value) && sort.length === stableSort.length;
      if (url.searchParams.get('page') === '1') {
        await route.fulfill({ json: refPage(stable ? [next, older] : [anchor, next], 1, 2, 4) });
        return;
      }
      await route.fulfill({ json: refPage(stable ? [first, anchor] : [anchor, first], 0, 2, 4) });
    });

    await page.goto(`/tag/public?debug=ADMIN&view=list&sort=${field},DESC&pageSize=2&pageNumber=0`);
    const links = page.locator('.ref-list-item .link a');
    await expect(links).toHaveText([`${field} first`, `${field} anchor`]);
    const firstPage = await links.allTextContents();

    await page.locator('.next-page').click();

    await expect.poll(() => offsetRequests.filter(request => request.searchParams.get('page') === '1').length).toBe(1);
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
    for (const request of [...offsetRequests, ...cursorRequests]) {
      expect(request.searchParams.getAll('sort')).toEqual(stableSort);
      expect(request.searchParams.get('size')).toBe('2');
    }
    expect(cursorRequests).toEqual([]);
    expect(page.url()).toContain('pageNumber=1');
    expect(new URL(page.url()).searchParams.getAll('sort')).toEqual([`${field},DESC`]);
    expect(page.url()).not.toContain(`${field}Before`);
  });
}

function ref(slug: string, title: string, date: string, modified = date, origin = '') {
  return {
    url: `https://example.com/${slug}`,
    origin,
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
