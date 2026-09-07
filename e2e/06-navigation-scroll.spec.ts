import { expect, type Page, test } from '@playwright/test';

const tag = 'scrollnavigation';
const refs = Array.from({ length: 32 }, (_, index) => ({
  url: `comment:scroll-navigation/${index}`,
  origin: '',
  title: `Scroll navigation item ${index + 1}`,
  tags: [tag],
  published: '2024-01-02T00:00:00.000Z',
  created: '2024-01-02T00:00:00.000Z',
  modified: '2024-01-02T00:00:00.000Z',
}));
const selected = refs[24];

async function resetScrollCalls(page: Page) {
  await page.evaluate(() => (window as any).selectedItemScrolls = 0);
}

async function expectNoSelectedItemScroll(page: Page) {
  // Selected-item restoration is delayed by 400ms after the list renders.
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => (window as any).selectedItemScrolls)).toBe(0);
}

for (const theme of ['light', 'dark'] as const) {
  test(`only restores the selected item on Back in ${theme} mode`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript(() => {
      history.scrollRestoration = 'manual';
      (window as any).selectedItemScrolls = 0;
      const scrollTo = window.scrollTo.bind(window);
      window.scrollTo = ((...args: any[]) => {
        if (args[0]?.behavior === 'smooth') (window as any).selectedItemScrolls++;
        (scrollTo as any)(...args);
      }) as typeof window.scrollTo;
    });
    await page.route('**/api/v1/ref/page**', async route => {
      const params = new URL(route.request().url()).searchParams;
      const url = params.get('url');
      const query = params.get('query');
      if (query !== tag && !query?.startsWith(`${tag}:`) && !refs.some(ref => ref.url === url)) {
        await route.fallback();
        return;
      }
      const content = url ? refs.filter(ref => ref.url === url) : refs;
      await route.fulfill({
        json: {
          content,
          page: { number: 0, size: content.length, totalElements: content.length, totalPages: 1 },
        },
      });
    });

    await page.goto(`/tag/${tag}?debug=ADMIN&view=list`);
    await expect(page.locator('body')).toHaveClass(new RegExp(`${theme}-theme`));
    const item = page.locator('.ref-list-item').filter({ hasText: selected.title });
    const openItem = async () => {
      await item.locator('.link a').click();
      await expect(page.locator('.full-page.ref .link a')).toHaveText(selected.title);
    };
    await expect(page.locator('.ref-list-item')).toHaveCount(refs.length);
    await openItem();

    // Returning to the same list by clicking a tag is forward navigation.
    await resetScrollCalls(page);
    await page.locator('.full-page.ref .tag').filter({ hasText: tag }).click();
    await expect(item).toHaveClass(/last-selected/);
    await expectNoSelectedItemScroll(page);

    // A reload restarts Angular navigation IDs but must preserve history ordering.
    await page.reload();
    await expect(page.locator('.ref-list-item')).toHaveCount(refs.length);
    await openItem();
    await resetScrollCalls(page);
    await page.goBack();
    await expect(item).toHaveClass(/last-selected/);
    await expect.poll(() => page.evaluate(() => (window as any).selectedItemScrolls)).toBe(1);
    await expect(item).toBeInViewport();
    await testInfo.attach(`back-${theme}`, { body: await page.screenshot(), contentType: 'image/png' });

    // Revisit that list with browser Forward after traversing older entries.
    await page.goBack();
    await expect(page.locator('.full-page.ref .link a')).toHaveText(selected.title);
    await resetScrollCalls(page);
    await page.goBack();
    await expect(item).toHaveClass(/last-selected/);
    await expect.poll(() => page.evaluate(() => (window as any).selectedItemScrolls)).toBe(1);
    await page.goForward();
    await expect(page.locator('.full-page.ref .link a')).toHaveText(selected.title);
    // Same-URL navigation replaces this entry without removing browser Forward.
    await page.locator('.full-page.ref .link a').click();
    await resetScrollCalls(page);
    await page.goForward();
    await expect(item).toHaveClass(/last-selected/);
    await expectNoSelectedItemScroll(page);
    await testInfo.attach(`forward-${theme}`, { body: await page.screenshot(), contentType: 'image/png' });
  });
}
