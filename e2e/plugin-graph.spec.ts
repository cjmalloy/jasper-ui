import { test, expect, type Page } from '@playwright/test';
import { clearMods, deleteRef, openSidebar } from './setup';

test.describe.serial('Graph Plugin', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('clear mods', async () => {
    await clearMods(page);
  });

  test('turn on graphing', async () => {
    await page.goto('/settings/setup?debug=ADMIN');
    await page.waitForTimeout(100);
    await page.locator('#mod-experiments').waitFor();
    if (!(await page.locator('#mod-experiments').isChecked())) {
      await page.locator('#mod-experiments').check();
    }
    await expect(page.locator('#mod-experiments')).toBeChecked();
    await page.locator('button', { hasText: 'Save' }).click();
    await page.locator('.log div', { hasText: 'Success.' }).first().waitFor({ timeout: 15_000, state: 'attached' });
    await page.reload();

    await page.waitForTimeout(100);
    await page.locator('#mod-graph').waitFor({ timeout: 30000 });
    if (!(await page.locator('#mod-graph').isChecked())) {
      await page.locator('#mod-graph').check();
    }
    await expect(page.locator('#mod-graph')).toBeChecked();
    await page.locator('button', { hasText: 'Save' }).click();
    await page.locator('.log div', { hasText: 'Success.' }).first().waitFor({ timeout: 15_000, state: 'attached' });
  });

  test('creates a ref', async () => {
    // Clean up any existing ref from a previous failed run/retry
    await page.goto('/tag/@*?search=Title&debug=ADMIN');
    for (let i = 0; i < 5; i++) {
      const ref = page.locator('.ref-list .ref .actions .fake-link', { hasText: 'delete' }).first();
      if (!(await ref.isVisible({ timeout: 2_000 }).catch(() => false))) break;
      await ref.click();
      await page.locator('.ref-list .ref .actions .fake-link', { hasText: 'yes' }).first().click();
      await page.waitForTimeout(500);
      await page.reload();
    }
    await page.goto('/?debug=USER');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('.tabs a', { hasText: 'text' }).first().click();
    await page.locator('[name=title]').pressSequentially('Title', { delay: 100 });
    await page.getByText('show advanced').click();
    await page.locator('[name=published]').pressSequentially('2020-01-01T00:00', { delay: 100 });
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Title');
  });

  test('shows graph', async () => {
    await page.locator('.full-page .actions .fake-link', { hasText: 'edit' }).first().click();
    const url = await page.locator('[name=url]').inputValue();
    await page.goto('/tag/@*?search=' + url + '&debug=USER');
    await page.locator('.tabs a', { hasText: 'graph' }).first().click();
    await expect(page.locator('figure')).toContainText('Title');
  });

  test('creates reply', async () => {
    await page.locator('.ref .actions .fake-link', { hasText: 'reply' }).first().click();
    await page.locator('.comment-reply textarea').pressSequentially('Reply', { delay: 100 });
    const replyPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'reply' }).click();
    await replyPromise;
    await page.waitForTimeout(1000);
    await page.locator('.ref .actions a', { hasText: 'permalink' }).first().click();
    await page.locator('.tabs a', { hasText: 'responses' }).first().click();
    await page.locator('.ref-list-item.ref .actions a', { hasText: 'permalink' }).first().click();
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Reply');
  });

  test('graphs reply', async () => {
    await page.locator('.full-page .actions .fake-link', { hasText: 'edit' }).first().click();
    const url = await page.locator('[name=url]').inputValue();
    await page.goto('/tag/@*?search=' + url + '&debug=USER');
    await page.locator('.tabs a', { hasText: 'graph' }).first().click();
    await expect(page.locator('figure')).toContainText('Reply');
    const loadMore = page.locator('.load-more');
    if (await loadMore.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await loadMore.click();
    }
    await page.locator('figure').click({ button: 'right' });
    await page.getByText('Select all').click();
    await expect(page.locator('figure')).toContainText('Title');
  });
});
