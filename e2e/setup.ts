import { type Page } from '@playwright/test';

export async function clearMods(page: Page, base = '') {
  await page.goto(base + '/settings/plugin?debug=ADMIN&pageSize=2000');
  await page.waitForLoadState('networkidle');
  const plugins = page.locator('.list-container .plugin:not(.deleted)');
  const pluginCount = await plugins.count();
  for (let i = 0; i < pluginCount; i++) {
    const p = plugins.first();
    const deletePromise = page.waitForResponse(resp => resp.url().includes('/api/v1/plugin') && resp.request().method() === 'DELETE');
    await plugins.first().locator('.action .fake-link', { hasText: 'delete' }).click();
    await page.waitForLoadState('networkidle');
    await plugins.first().locator('.action .fake-link', { hasText: 'yes' }).click();
    await deletePromise;
  }
  await page.goto(base + '/settings/template?debug=ADMIN&pageSize=2000');
  await page.waitForLoadState('networkidle');
  const templates = page.locator('.list-container .template:not(.deleted):not(.config_index):not(.config_server)');
  let templateCount = await templates.count();
  for (let i = 0; i < templateCount; i++) {
   const deletePromise = page.waitForResponse(resp => resp.url().includes('/api/v1/template') && resp.request().method() === 'DELETE');
    await templates.first().locator('.action .fake-link', { hasText: 'delete' }).click();
    await page.waitForLoadState('networkidle');
    await templates.first().locator('.action .fake-link', { hasText: 'yes' }).click();
    await deletePromise;
  }
}

export async function clearAll(page: Page, base = '') {
  await page.goto(base + '/settings/backup?debug=ADMIN');
  await page.waitForLoadState('networkidle');
  await page.locator('form select').selectOption('');
  page.on('dialog', dialog => dialog.accept('default'));
  await page.locator('button', { hasText: '– delete' }).click();
  await page.reload();
  await clearMods(page, base);
  await page.reload();
}

export async function deleteRef(page: Page, url: string, base = '') {
  await page.goto(base + `/ref/e/${encodeURIComponent(url)}?debug=ADMIN`);
  const deleteBtn = page.locator('.full-page.ref .actions .fake-link', { hasText: 'delete' });
  if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await deleteBtn.first().click();
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'yes' }).first().click();
    await page.waitForTimeout(500);
  }
}

export async function openSidebar(page: Page) {
  await page.locator('.sidebar').waitFor();
  const sidebar = page.locator('.sidebar');
  if (!await sidebar.evaluate(el => el.classList.contains('expanded'))) {
    await sidebar.locator('.row .toggle').click();
  }
}

export async function closeSidebar(page: Page) {
  await page.locator('.sidebar').waitFor();
  const sidebar = page.locator('.sidebar');
  if (await sidebar.evaluate(el => el.classList.contains('expanded'))) {
    await sidebar.locator('.row .toggle').click();
  }
}
