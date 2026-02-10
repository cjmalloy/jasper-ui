import { test, expect, type Page } from '@playwright/test';
import { clearMods, openSidebar } from './setup';

test.describe.serial('Graph Plugin', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('loads the page', async () => {
    await page.goto('/?debug=USER');
    await expect(page.getByText('Powered by Jasper')).toBeVisible({ timeout: 1000 * 60 });
  });

  test('clear mods', async () => {
    await clearMods(page);
  });

  test('turn on graphing', async () => {
    await page.goto('/settings/setup?debug=ADMIN');

    await page.waitForTimeout(100);
    await page.locator('#mod-experiments').waitFor();
    await expect(page.locator('#mod-experiments')).not.toBeChecked();
    await page.locator('#mod-experiments').check();
    await expect(page.locator('#mod-experiments')).toBeChecked();
    await page.locator('button', { hasText: 'Save' }).click();
    await page.reload();

    await page.waitForTimeout(100);
    await page.locator('#mod-graph').waitFor();
    await expect(page.locator('#mod-graph')).not.toBeChecked();
    await page.locator('#mod-graph').check();
    await expect(page.locator('#mod-graph')).toBeChecked();
    await page.locator('button', { hasText: 'Save' }).click();
    await expect(page.locator('.log')).toContainText('Success');
  });

  test('creates a ref', async () => {
    await page.goto('/?debug=USER');
    await openSidebar(page);
    await page.getByText('Submit', { exact: true }).click();
    await page.locator('.tabs a').getByText('text').click();
    await page.locator('[name=title]').fill('Title');
    await page.getByText('show advanced').click();
    await page.locator('[name=published]').fill('2020-01-01T00:00');
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Title');
  });

  test('shows graph', async () => {
    await page.locator('.full-page .actions').getByText('edit').click();
    const url = await page.locator('[name=url]').inputValue();
    await page.goto('/tag/@*?search=' + url + '&debug=USER');
    await page.locator('.tabs a').getByText('graph').click();
    await expect(page.locator('figure')).toContainText('Title');
  });

  test('creates reply', async () => {
    await page.locator('.ref .actions').getByText('reply').click();
    await page.locator('.comment-reply textarea').fill('Reply');
    const replyPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'reply' }).click();
    await replyPromise;
    await page.waitForTimeout(1000);
    await page.locator('.ref .actions').getByText('permalink').click();
    await page.locator('.tabs a').getByText('responses').click();
    await page.locator('.ref-list-item.ref .actions').getByText('permalink').click();
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Reply');
  });

  test('graphs reply', async () => {
    await page.locator('.full-page .actions').getByText('edit').click();
    const url = await page.locator('[name=url]').inputValue();
    await page.goto('/tag/@*?search=' + url + '&debug=USER');
    await page.locator('.tabs a').getByText('graph').click();
    await expect(page.locator('figure')).toContainText('Reply');
    await page.getByText('load more').click();
    await page.locator('figure').click({ button: 'right' });
    await page.getByText('Select all').click();
    await expect(page.locator('figure')).toContainText('Title');
  });
});
