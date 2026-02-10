import { test, expect, type Page } from '@playwright/test';
import { addToBoard, dragCol } from './template-kanban';
import { clearMods, closeSidebar, openSidebar } from './setup';

async function loadBoard(page: Page) {
  const pagePromises = Array.from({ length: 9 }, () =>
    page.waitForResponse(resp => resp.url().includes('/api/v1/ref/page'))
  );
  await page.goto('/tag/kanban/sl?debug=USER');
  await Promise.all(pagePromises);
}

test.describe.serial('Kanban Template with Swim Lanes', () => {
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

  test('turn on kanban', async () => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'setup' }).first().click();

    await page.waitForTimeout(100);
    await page.locator('#mod-root').waitFor();
    if (!(await page.locator('#mod-root').isChecked())) {
      await page.locator('#mod-root').check();
    }
    await expect(page.locator('#mod-root')).toBeChecked();
    await page.locator('#mod-kanban').waitFor();
    if (!(await page.locator('#mod-kanban').isChecked())) {
      await page.locator('#mod-kanban').check();
    }
    await expect(page.locator('#mod-kanban')).toBeChecked();
    await page.locator('button', { hasText: 'Save' }).click();
    await page.locator('.log div', { hasText: 'Success.' }).first().waitFor({ timeout: 15_000, state: 'attached' });
  });

  test('creates a board with swim lanes', async () => {
    await page.goto('/tags/kanban?debug=MOD');
    await openSidebar(page);
    await page.getByText('Extend').click();
    await page.locator('[name=tag]').pressSequentially('sl', { delay: 100 });
    await page.locator('button', { hasText: 'Extend' }).click();
    await page.locator('[name=name]').pressSequentially('Kanban Swim Lane Test', { delay: 100 });
    await page.locator('.columns button').first().click();
    await page.waitForTimeout(100);
    await page.keyboard.type('doing', { delay: 100 });
    await page.keyboard.press('Enter', { delay: 100 });
    await page.keyboard.type('done', { delay: 100 });
    await page.locator('[name=showColumnBacklog]').click();
    await page.locator('[name=columnBacklogTitle]').pressSequentially('todo', { delay: 100 });
    await page.locator('.swim-lanes button').first().click();
    await page.waitForTimeout(100);
    await page.keyboard.type('alice', { delay: 100 });
    await page.keyboard.press('Enter', { delay: 100 });
    await page.keyboard.type('bob', { delay: 100 });
    await page.locator('[name=showSwimLaneBacklog]').click();
    await page.locator('button', { hasText: 'Save' }).click();
    await expect(page.locator('h2')).toHaveText('Kanban Swim Lane Test');
  });

  test('add to board', async () => {
    await page.goto('/tag/kanban/sl?debug=MOD');
    await closeSidebar(page);
    await loadBoard(page);
    await page.waitForTimeout(1000);
    await addToBoard(page, 7, 'first step');
    await page.locator('.kanban-column:nth-of-type(7) a', { hasText: 'first step' }).first().click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Swim Lane Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'alice' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'bob' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'doing' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'done' })).toHaveCount(0);
  });

  test('move to doing', async () => {
    await page.goto('/tag/kanban/sl?debug=MOD');
    await loadBoard(page);
    await dragCol(page, 7, 8);
    await page.locator('.kanban-column:nth-of-type(8) a', { hasText: 'first step' }).first().click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Swim Lane Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'alice' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'bob' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'doing' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'done' })).toHaveCount(0);
  });

  test('move to done', async () => {
    await page.goto('/tag/kanban/sl?debug=MOD');
    await loadBoard(page);
    await dragCol(page, 8, 9);
    await page.locator('.kanban-column:nth-of-type(9) a', { hasText: 'first step' }).first().click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Swim Lane Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'alice' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'bob' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'doing' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'done' })).toBeVisible();
  });

  test('move to untagged col', async () => {
    await page.goto('/tag/kanban/sl?debug=MOD');
    await loadBoard(page);
    await dragCol(page, 9, 7);
    await page.locator('.kanban-column:nth-of-type(7) a', { hasText: 'first step' }).first().click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Swim Lane Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'alice' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'bob' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'doing' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'done' })).toHaveCount(0);
  });

  test('assign to alice', async () => {
    await page.goto('/tag/kanban/sl?debug=MOD');
    await loadBoard(page);
    await dragCol(page, 7, 1);
    await page.locator('.kanban-column:nth-of-type(1) a', { hasText: 'first step' }).first().click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Swim Lane Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'alice' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'bob' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'doing' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'done' })).toHaveCount(0);
  });

  test('move to alice doing', async () => {
    await page.goto('/tag/kanban/sl?debug=MOD');
    await loadBoard(page);
    await dragCol(page, 1, 2);
    await page.locator('.kanban-column:nth-of-type(2) a', { hasText: 'first step' }).first().click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Swim Lane Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'alice' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'bob' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'doing' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'done' })).toHaveCount(0);
  });

  test('move to alice done', async () => {
    await page.goto('/tag/kanban/sl?debug=MOD');
    await loadBoard(page);
    await dragCol(page, 2, 3);
    await page.locator('.kanban-column:nth-of-type(3) a', { hasText: 'first step' }).first().click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Swim Lane Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'alice' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'bob' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'doing' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'done' })).toBeVisible();
  });

  test('move to alice todo', async () => {
    await page.goto('/tag/kanban/sl?debug=MOD');
    await loadBoard(page);
    await dragCol(page, 3, 1);
    await page.locator('.kanban-column:nth-of-type(1) a', { hasText: 'first step' }).first().click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Swim Lane Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'alice' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'bob' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'doing' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'done' })).toHaveCount(0);
  });

  test('move to alice doing again', async () => {
    await page.goto('/tag/kanban/sl?debug=MOD');
    await loadBoard(page);
    await dragCol(page, 1, 2);
    await page.locator('.kanban-column:nth-of-type(2) a', { hasText: 'first step' }).first().click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Swim Lane Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'alice' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'bob' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'doing' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'done' })).toHaveCount(0);
  });

  test('assign to bob', async () => {
    await page.goto('/tag/kanban/sl?debug=MOD');
    await loadBoard(page);
    await dragCol(page, 2, 4);
    await page.locator('.kanban-column:nth-of-type(4) a', { hasText: 'first step' }).first().click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Swim Lane Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'alice' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'bob' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'doing' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'done' })).toHaveCount(0);
  });

  test('move to bob doing', async () => {
    await page.goto('/tag/kanban/sl?debug=MOD');
    await loadBoard(page);
    await dragCol(page, 4, 5);
    await page.locator('.kanban-column:nth-of-type(5) a', { hasText: 'first step' }).first().click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Swim Lane Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'alice' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'bob' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'doing' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'done' })).toHaveCount(0);
  });

  test('move to bob done', async () => {
    await page.goto('/tag/kanban/sl?debug=MOD');
    await loadBoard(page);
    await dragCol(page, 5, 6);
    await page.locator('.kanban-column:nth-of-type(6) a', { hasText: 'first step' }).first().click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Swim Lane Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'alice' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'bob' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'doing' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'done' })).toBeVisible();
  });

  test('move to trash', async () => {
    await page.goto('/tag/kanban/sl?debug=MOD');
    await loadBoard(page);
    await dragCol(page, 6);
    await loadBoard(page);
    await expect(page.locator('.kanban-column', { hasText: 'first step' })).toHaveCount(0);
  });

  test('add to alice doing', async () => {
    await page.goto('/tag/kanban/sl?debug=MOD');
    await loadBoard(page);
    await addToBoard(page, 2, 'second step');
    await page.locator('.kanban-column:nth-of-type(2) a', { hasText: 'second step' }).click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Swim Lane Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'alice' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'bob' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'doing' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'done' })).toHaveCount(0);
  });

  test('move to trash again', async () => {
    await page.goto('/tag/kanban/sl?debug=MOD');
    await loadBoard(page);
    await dragCol(page, 2);
    await page.reload();
    await expect(page.locator('.kanban-column', { hasText: 'second step' })).toHaveCount(0);
  });

  test('deletes board', async () => {
    await page.goto('/ext/kanban/sl?debug=MOD');
    page.on('dialog', async dialog => await dialog.accept());
    await page.locator('button', { hasText: 'Delete' }).click();
  });
});
