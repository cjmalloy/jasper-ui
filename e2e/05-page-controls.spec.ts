import { expect, test } from '@playwright/test';

const dateSorts = ['published', 'created'] as const;

for (const field of dateSorts) {
  test(`secretly cursor-pages duplicate ${field} dates`, async ({ page }) => {
    const date = '2024-01-02T00:00:00.000Z';
    const anchor = ref(`${field}-anchor`, `${field} anchor`, date);
    const older = ref(`${field}-older`, `${field} older`, '2024-01-01T00:00:00.000Z');
    const duplicate = ref(`${field}-duplicate`, `${field} duplicate`, date);
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
          json: refPage([duplicate, anchor, older], 0, Number(url.searchParams.get('size')), 3),
        });
        return;
      }
      if (url.searchParams.get('page') === '1') {
        await route.fulfill({ json: refPage([anchor, older], 1, 2, 6) });
        return;
      }
      await route.fallback();
    });

    await page.goto(`/tag/public?debug=ADMIN&view=list&sort=${field},DESC&pageSize=2&pageNumber=1`);

    await expect.poll(() => cursorRequests.length).toBe(1);
    await expect(page.locator('.ref-list-item .link a')).toHaveText([
      `${field} anchor`,
      `${field} older`,
    ]);
    expect(cursorRequests[0].searchParams.get('page')).toBe('0');
    expect(Number(cursorRequests[0].searchParams.get('size'))).toBeGreaterThan(2);
    expect(page.url()).toContain('pageNumber=1');
    expect(page.url()).not.toContain(`${field}Before`);
  });
}

function ref(slug: string, title: string, date: string) {
  return {
    url: `https://example.com/${slug}`,
    origin: '',
    title,
    tags: ['public'],
    published: date,
    created: date,
    modified: date,
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
