import { test, expect, type Page } from '@playwright/test';
import { addToBoard, dragCol } from './template-kanban';
import { clearMods, closeSidebar, openSidebar } from './setup';

async function loadBoard(page: Page) {
  const pagePromises = Array.from({ length: 3 }, () =>
    page.waitForResponse(resp => resp.url().includes('/api/v1/ref/page'))
  );
  await page.goto('/tag/kanban/test?debug=USER');
  await Promise.all(pagePromises);
}

test.describe.serial('Kanban Template No Swimlanes', () => {
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

  test('turn on kanban', async () => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs', { hasText: 'setup' }).click();

    await page.waitForTimeout(100);
    await expect(page.locator('#mod-root')).not.toBeChecked();
    await page.locator('#mod-root').check();
    await expect(page.locator('#mod-root')).toBeChecked();
    await expect(page.locator('#mod-kanban')).not.toBeChecked();
    await page.locator('#mod-kanban').check();
    await expect(page.locator('#mod-kanban')).toBeChecked();
    await page.locator('button', { hasText: 'Save' }).click();
    await expect(page.locator('.log')).toContainText('Success');
  });

  test('creates a board', async () => {
    await page.goto('/?debug=MOD');
    await page.locator('.subs').getByText('tags').click();
    await openSidebar(page);
    await page.getByText('Extend').click();
    await page.locator('[name=tag]').fill('kanban/test');
    await page.locator('button', { hasText: 'Extend' }).click();
    await page.locator('[name=name]').fill('Kanban Test');
    await page.locator('.columns button').click();
    await page.keyboard.type('doing');
    await page.keyboard.press('Enter');
    await page.keyboard.type('done');
    await page.locator('[name=showColumnBacklog]').click();
    await page.locator('[name=columnBacklogTitle]').fill('todo');
    await page.locator('button', { hasText: 'Save' }).click();
    await expect(page.locator('h2')).toHaveText('Kanban Test');
  });

  test('add to board', async () => {
    await closeSidebar(page);
    await loadBoard(page);
    await page.waitForTimeout(1000);
    await addToBoard(page, 1, 'first step');
    await page.locator('.kanban-column:nth-of-type(1) a', { hasText: 'first step' }).click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)')).not.toContainText('doing');
    await expect(page.locator('.full-page.ref .tag:not(.user)')).not.toContainText('done');
  });

  test('move to doing', async () => {
    await loadBoard(page);
    await dragCol(page, 1, 2);
    await page.locator('.kanban-column:nth-of-type(2) a', { hasText: 'first step' }).click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'doing' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)')).not.toContainText('done');
  });

  test('move to done', async () => {
    await loadBoard(page);
    await dragCol(page, 2, 3);
    await page.locator('.kanban-column:nth-of-type(3) a', { hasText: 'first step' }).click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)')).not.toContainText('doing');
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'done' })).toBeVisible();
  });

  test('move to untagged col', async () => {
    await loadBoard(page);
    await dragCol(page, 3, 1);
    await page.locator('.kanban-column:nth-of-type(1) a', { hasText: 'first step' }).click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)')).not.toContainText('doing');
    await expect(page.locator('.full-page.ref .tag:not(.user)')).not.toContainText('done');
  });

  test('move to trash', async () => {
    await loadBoard(page);
    await dragCol(page, 1);
    await expect(page.locator('.kanban-column', { hasText: 'first step' })).toHaveCount(0);
  });

  test('deletes board', async () => {
    await page.goto('/ext/kanban/test?debug=MOD');
    await page.locator('button', { hasText: 'Delete' }).click();
  });
});
