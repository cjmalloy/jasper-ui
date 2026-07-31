import { expect, test } from '@playwright/test';

const dateSorts = ['published', 'created', 'modified'] as const;

for (const field of dateSorts) {
  test(`uses cursors for next and previous pages with duplicate ${field} dates`, async ({ page }) => {
    const date = '2024-01-02T00:00:00.000Z';
    const modified = field === 'modified' ? date : '2024-01-01T00:00:00.000Z';
    const first = ref({
      slug: `${field}-first`,
      title: `${field} first`,
      date,
      modified,
      origin: '@a',
    });
    const anchor = ref({
      slug: `${field}-anchor`,
      title: `${field} anchor`,
      date,
      modified,
      origin: '@b',
    });
    const next = ref({
      slug: `${field}-next`,
      title: `${field} next`,
      date,
      modified: field === 'modified' ? modified : '2024-01-01T00:00:00.001Z',
      origin: field === 'modified' ? '@c' : '@a',
    });
    const older = ref({
      slug: `${field}-older`,
      title: `${field} older`,
      date: '2024-01-01T00:00:00.000Z',
      origin: '@a',
    });
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
      if (url.searchParams.has(`${field}Before`)) {
        cursorRequests.push(url);
        const size = Number(url.searchParams.get('size'));
        const requestPage = Number(url.searchParams.get('page') ?? 0);
        const start = requestPage * size;
        await route.fulfill({
          json: refPage(
            [first, anchor, next, older].slice(start, start + size),
            requestPage,
            size,
            4,
          ),
        });
        return;
      }
      if (url.searchParams.has(`${field}After`)) {
        cursorRequests.push(url);
        await route.fulfill({
          json: refPage(
            [next, anchor, first],
            0,
            Number(url.searchParams.get('size')),
            3,
          ),
        });
        return;
      }
      if (sort[0] !== `${field},DESC`) {
        await route.fallback();
        return;
      }
      offsetRequests.push(url);
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

    await expect.poll(() => cursorRequests.length).toBe(2);
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
    expect(offsetRequests).toHaveLength(1);
    expect(offsetRequests[0].searchParams.getAll('sort')).toEqual([`${field},DESC`]);
    const [initial, retry] = cursorRequests;
    for (const request of [initial, retry]) {
      expect(request.searchParams.getAll('sort')).toEqual(stableSort);
    }
    expect(initial.searchParams.has('page')).toBe(false);
    expect(retry.searchParams.get('page')).toBe('1');
    expect([initial, retry].map(request => request.searchParams.get('size')))
      .toEqual(['3', '3']);
    expect(page.url()).toContain('pageNumber=1');
    expect(new URL(page.url()).searchParams.getAll('sort')).toEqual([`${field},DESC`]);
    expect(page.url()).not.toContain(`${field}Before`);

    await page.locator('.prev-page').click();

    await expect.poll(() => cursorRequests.length).toBe(3);
    await expect(links).toHaveText([`${field} first`, `${field} anchor`]);
    expect(offsetRequests).toHaveLength(1);
    const previous = cursorRequests[2];
    expect(previous.searchParams.getAll('sort')).toEqual(reverseSort(stableSort));
    expect(previous.searchParams.has('page')).toBe(false);
    expect(page.url()).toContain('pageNumber=0');
    expect(page.url()).not.toContain(`${field}After`);
  });
}

interface RefValues {
  slug: string;
  title: string;
  date: string;
  modified?: string;
  origin?: string;
}

function ref(values: RefValues) {
  return {
    url: `https://example.com/${values.slug}`,
    origin: values.origin ?? '',
    title: values.title,
    tags: ['public'],
    published: values.date,
    created: values.date,
    modified: values.modified ?? values.date,
  };
}

function reverseSort(sort: string[]) {
  return sort.map(value => value.endsWith(',DESC')
    ? value.replace(/,DESC$/, ',ASC')
    : value.replace(/,ASC$/, ',DESC'));
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
