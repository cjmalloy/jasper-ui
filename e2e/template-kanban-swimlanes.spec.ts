import { expect, type Page, test } from '@playwright/test';
import { clearAll, closeSidebar, mod, openSidebar } from './setup';
import { addToBoard, dragCol } from './template-kanban';

async function loadBoard(page: Page) {
  const pagePromises = Array.from({ length: 9 }, () =>
    page.waitForResponse(resp => resp.url().includes('/api/v1/ref/page'))
  );
  await page.goto('/tag/kanban/sl?debug=USER');
  await Promise.all(pagePromises);
}

test.describe.serial('Kanban Template with Swim Lanes', () => {

  test('clear all', async ({ page }) => {
    await clearAll(page);
  });

  test('turn on kanban', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-kanban');
  });

  test('creates a board with swim lanes', async ({ page }) => {
    // Clean up any existing board from a previous failed run/retry
    await page.goto('/ext/kanban/sl?debug=MOD', { waitUntil: 'networkidle' });
    const deleteBtn = page.locator('button', { hasText: 'Delete' });
    if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      page.once('dialog', dialog => dialog.accept());
      await deleteBtn.click();
      await page.waitForURL(/\/tag\//, { timeout: 5_000 }).catch(() => {});
    }
    await page.goto('/tags/kanban?debug=MOD');
    await openSidebar(page);
    await page.getByText('Extend').click();
    await page.locator('[name=tag]').fill('sl');
    await page.locator('button', { hasText: 'Extend' }).click();
    // Wait for template form to fully render (async via defer())
    await page.locator('.columns').waitFor({ timeout: 15_000 });
    await page.locator('[name=name]').fill('Kanban Swim Lane Test');
    await page.locator('.columns button').first().click();
    const colInput1 = page.locator('.columns input').last();
    await colInput1.waitFor({ state: 'attached'});
    await colInput1.fill('doing');
    await colInput1.press('Enter');
    await page.waitForTimeout(1000);
    const colInput2 = page.locator('.columns input').last();
    await colInput2.waitFor({ state: 'attached'});
    await colInput2.fill('done');
    await page.locator('[name=showColumnBacklog]').check();
    await page.locator('[name=columnBacklogTitle]').fill('todo');
    await page.locator('.swim-lanes button').first().click();
    const laneInput1 = page.locator('.swim-lanes input').last();
    await laneInput1.waitFor({ state: 'attached'});
    await laneInput1.fill('alice');
    await laneInput1.press('Enter');
    await page.waitForTimeout(1000);
    const laneInput2 = page.locator('.swim-lanes input').last();
    await laneInput2.waitFor({ state: 'attached'});
    await laneInput2.fill('bob');
    await page.locator('[name=showSwimLaneBacklog]').check();
    await page.locator('button', { hasText: 'Save' }).click();
    await expect(page.locator('h2')).toHaveText('Kanban Swim Lane Test');
  });

  test('add to board', async ({ page }) => {
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

  test('move to doing', async ({ page }) => {
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

  test('move to done', async ({ page }) => {
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

  test('move to untagged col', async ({ page }) => {
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

  test('assign to alice', async ({ page }) => {
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

  test('move to alice doing', async ({ page }) => {
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

  test('move to alice done', async ({ page }) => {
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

  test('move to alice todo', async ({ page }) => {
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

  test('move to alice doing again', async ({ page }) => {
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

  test('assign to bob', async ({ page }) => {
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

  test('move to bob doing', async ({ page }) => {
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

  test('move to bob done', async ({ page }) => {
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

  test('move to trash', async ({ page }) => {
    await page.goto('/tag/kanban/sl?debug=MOD');
    await loadBoard(page);
    await dragCol(page, 6);
    await loadBoard(page);
    await expect(page.locator('.kanban-column', { hasText: 'first step' })).toHaveCount(0);
  });

  test('add to alice doing', async ({ page }) => {
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

  test('move to trash again', async ({ page }) => {
    await page.goto('/tag/kanban/sl?debug=MOD');
    await loadBoard(page);
    await dragCol(page, 2);
    await page.reload();
    await expect(page.locator('.kanban-column', { hasText: 'second step' })).toHaveCount(0);
  });

  test('deletes board', async ({ page }) => {
    await page.goto('/ext/kanban/sl?debug=MOD');
    page.once('dialog', async dialog => await dialog.accept());
    await page.locator('button', { hasText: 'Delete' }).click();
  });
});
