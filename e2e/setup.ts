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

export async function deleteRef(page: Page, url: string, base = '') {
  await page.goto(base + `/ref/e/${encodeURIComponent(url)}?debug=ADMIN`);
  const deleteBtn = page.locator('.full-page.ref .actions .fake-link', { hasText: 'delete' });
  if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await deleteBtn.first().click();
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'yes' }).first().click();
    await page.waitForTimeout(500);
  }
}

export async function deleteOrigin(page: Page, apiProxy: string, originName: string, base = '') {
  await page.goto(base + '/?debug=ADMIN');
  await page.locator('.settings a', { hasText: 'settings' }).click();
  await page.locator('.tabs a', { hasText: 'origin' }).first().click();
  await openSidebar(page);
  await page.locator('input[type=search]').pressSequentially(apiProxy, { delay: 100 });
  await page.locator('input[type=search]').press('Enter');
  const existing = page.locator('.link:not(.remote)', { hasText: originName }).locator('..').locator('..').locator('..');
  if (await existing.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await existing.locator('.actions .fake-link', { hasText: 'delete' }).first().click();
    await existing.locator('.actions .fake-link', { hasText: 'yes' }).first().click();
    await page.waitForTimeout(500);
  }
  await page.locator('input[type=search]').clear();
  await page.locator('input[type=search]').press('Enter');
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
