import { type Page } from '@playwright/test';
import { closeSidebar } from './setup';

export async function addToBoard(page: Page, col: number, text: string) {
  const addPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST');
  await page.locator(`.kanban-column:nth-of-type(${col})`).hover();
  const input = page.locator(`.kanban-column:nth-of-type(${col})`).first().locator('input');
  await input.focus();
  await input.fill(text);
  await input.press('Enter');
  await addPromise;
}

export async function dragCol(page: Page, from: number, to?: number) {
  await closeSidebar(page);
  const sourceCard = page.locator(`.kanban-column:nth-of-type(${from}) a`).last();
  await sourceCard.waitFor({ state: 'visible', timeout: 5_000 });
  await page.waitForTimeout(16);

  const sourceBox = await sourceCard.boundingBox();
  if (!sourceBox) throw new Error('Source element not found');

  // Start drag from center of source
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  // Small initial move to trigger drag
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2 + 10);

  const tagPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/tags') && resp.request().method() === 'PATCH');

  if (to) {
    const target = page.locator(`.kanban-column:nth-of-type(${to})`);
    const targetBox = await target.boundingBox();
    if (!targetBox) throw new Error('Target element not found');
    await page.mouse.move(targetBox.x + 30, targetBox.y + 30);
    await page.mouse.move(targetBox.x + 30, targetBox.y + 30);
    await target.hover();
    await page.waitForTimeout(1000);
    await page.mouse.up();
    await target.hover();
    await page.waitForTimeout(1000);
  } else {
    const removeTarget = page.locator('.kanban-remove').locator('..');
    const removeBox = await removeTarget.boundingBox();
    if (!removeBox) throw new Error('Remove target not found');
    await page.mouse.move(removeBox.x + 30, removeBox.y + 30);
    await page.mouse.move(removeBox.x + 30, removeBox.y + 30);
    await removeTarget.hover();
    await page.waitForTimeout(1000);
    await page.mouse.up();
    await removeTarget.hover();
    await page.waitForTimeout(1000);
  }
  await tagPromise;
}
