import { expect, type Page, test } from '@playwright/test';
import { clearAll, closeSidebar, mod, openSidebar } from './setup';
import { addToBoard, dragCol } from './template-kanban';

async function loadBoard(page: Page) {
  const pagePromises = Array.from({ length: 3 }, () =>
    page.waitForResponse(resp => resp.url().includes('/api/v1/ref/page'))
  );
  await page.goto('/tag/kanban/test?debug=USER');
  await Promise.all(pagePromises);
}

test.describe.serial('Kanban Template No Swimlanes', () => {

  test('clear all', async ({ page }) => {
    await clearAll(page);
  });

  test('turn on kanban', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-kanban');
  });

  test('creates a board', async ({ page }) => {
    // Clean up any existing board from a previous failed run/retry
    await page.goto('/ext/kanban/test?debug=MOD', { waitUntil: 'networkidle' });
    const deleteBtn = page.locator('button', { hasText: 'Delete' });
    if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      page.once('dialog', dialog => dialog.accept());
      await deleteBtn.click();
      await page.waitForURL(/\/tag\//, { timeout: 5_000 }).catch(() => {});
    }
    await page.goto('/tags/kanban?debug=MOD');
    await openSidebar(page);
    await page.getByText('Extend').click();
    await page.locator('[name=tag]').fill('test');
    await page.locator('button', { hasText: 'Extend' }).click();
    // Wait for template form to fully render (async via defer())
    await page.locator('.columns').waitFor({ timeout: 15_000 });
    await page.locator('[name=name]').fill('Kanban Test');
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
    await page.locator('button', { hasText: 'Save' }).click();
    await expect(page.locator('h2')).toHaveText('Kanban Test');
  });

  test('add to board', async ({ page }) => {
    await page.goto('/tag/kanban/test?debug=MOD');
    await closeSidebar(page);
    await loadBoard(page);
    await page.waitForTimeout(1000);
    await addToBoard(page, 1, 'first step');
    await page.locator('.kanban-column:nth-of-type(1) a', { hasText: 'first step' }).first().click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'doing' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'done' })).toHaveCount(0);
  });

  test('move to doing', async ({ page }) => {
    await page.goto('/tag/kanban/test?debug=MOD');
    await loadBoard(page);
    await dragCol(page, 1, 2);
    await page.locator('.kanban-column:nth-of-type(2) a', { hasText: 'first step' }).first().click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'doing' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'done' })).toHaveCount(0);
  });

  test('move to done', async ({ page }) => {
    await page.goto('/tag/kanban/test?debug=MOD');
    await loadBoard(page);
    await dragCol(page, 2, 3);
    await page.locator('.kanban-column:nth-of-type(3) a', { hasText: 'first step' }).first().click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'doing' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'done' }).first()).toBeVisible();
  });

  test('move to untagged col', async ({ page }) => {
    await page.goto('/tag/kanban/test?debug=MOD');
    await loadBoard(page);
    await dragCol(page, 3, 1);
    await page.locator('.kanban-column:nth-of-type(1) a', { hasText: 'first step' }).first().click();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'Kanban Test' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'doing' })).toHaveCount(0);
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'done' })).toHaveCount(0);
  });

  test('move to trash', async ({ page }) => {
    await page.goto('/tag/kanban/test?debug=MOD');
    await loadBoard(page);
    await dragCol(page, 1);
    await expect(page.locator('.kanban-column', { hasText: 'first step' })).toHaveCount(0);
  });

  test('deletes board', async ({ page }) => {
    await page.goto('/ext/kanban/test?debug=MOD');
    page.once('dialog', async dialog => await dialog.accept());
    await page.locator('button', { hasText: 'Delete' }).click();
  });
});
