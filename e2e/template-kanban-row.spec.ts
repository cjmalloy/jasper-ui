import { expect, type Page, test } from '@playwright/test';
import { clearMods, closeSidebar, openSidebar } from './setup';
import { addToBoard, dragCol } from './template-kanban';

async function loadBoard(page: Page) {
  const pagePromises = Array.from({ length: 3 }, () =>
    page.waitForResponse(resp => resp.url().includes('/api/v1/ref/page'))
  );
  await page.goto('/tag/kanban/test?debug=USER');
  await Promise.all(pagePromises);
}

test.describe.serial('Kanban Template No Swimlanes', () => {

  test('clear mods', async ({ page }) => {
    await clearMods(page);
  });

  test('turn on kanban', async ({ page }) => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'setup' }).first().click();

    await page.locator('#mod-root').check();
    await page.locator('#mod-kanban').check();
    await page.locator('button', { hasText: 'Save' }).click();
    await page.locator('.log div', { hasText: 'Success.' }).first().waitFor({ timeout: 15_000, state: 'attached' });
  });

  test('creates a board', async ({ page }) => {
    // Clean up any existing board from a previous failed run/retry
    await page.goto('/ext/kanban/test?debug=MOD');
    await page.waitForLoadState('networkidle');
    const deleteBtn = page.locator('button', { hasText: 'Delete' });
    if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      page.once('dialog', dialog => dialog.accept());
      await deleteBtn.click();
      await page.waitForURL(/\/tag\//, { timeout: 5_000 }).catch(() => {});
    }
    await page.goto('/tags/kanban?debug=MOD');
    await openSidebar(page);
    await page.getByText('Extend').click();
    await page.locator('[name=tag]').pressSequentially('test', { delay: 100 });
    await page.locator('button', { hasText: 'Extend' }).click();
    // Wait for template form to fully render (async via defer())
    await page.locator('.columns').waitFor({ timeout: 15_000 });
    await page.locator('[name=name]').pressSequentially('Kanban Test', { delay: 100 });
    await page.locator('.columns button').first().click();
    const colInput1 = page.locator('.columns input').last();
    await colInput1.waitFor({ state: 'attached'});
    await colInput1.pressSequentially('doing', { delay: 100 });
    await colInput1.press('Enter');
    const colInput2 = page.locator('.columns input').last();
    await colInput2.waitFor({ state: 'attached'});
    await colInput2.pressSequentially('done', { delay: 100 });
    await page.locator('[name=showColumnBacklog]').check();
    await page.locator('[name=columnBacklogTitle]').pressSequentially('todo', { delay: 100 });
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
    page.on('dialog', async dialog => await dialog.accept());
    await page.locator('button', { hasText: 'Delete' }).click();
  });
});
