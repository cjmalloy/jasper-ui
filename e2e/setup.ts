import { type Page } from '@playwright/test';

export async function clearMods(page: Page, base = '') {
  const loadPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/plugin/page') && resp.request().method() === 'GET');
  await page.goto(base + '/settings/plugin?debug=ADMIN&pageSize=2000');
  await loadPromise;
  const plugins = page.locator('.list-container .plugin');
  const pluginCount = await plugins.count();
  for (let i = 0; i < pluginCount; i++) {
    const deletePromise = page.waitForResponse(resp => resp.url().includes('/api/v1/plugin') && resp.request().method() === 'DELETE');
    await plugins.first().locator('.action', { hasText: 'delete' }).click();
    await plugins.first().locator('.action', { hasText: 'yes' }).click();
    await deletePromise;
  }
  const loadTemplatePromise = page.waitForResponse(resp => resp.url().includes('/api/v1/template/page') && resp.request().method() === 'GET');
  await page.goto(base + '/settings/template?debug=ADMIN&pageSize=2000');
  await loadTemplatePromise;
  const templates = page.locator('.list-container .template');
  let templateCount = await templates.count();
  while (templateCount > 0) {
    let found = false;
    for (let i = 0; i < templateCount; i++) {
      const hostText = await templates.nth(i).locator('.host').textContent();
      if (hostText?.startsWith('(_config/')) continue;
      const deletePromise = page.waitForResponse(resp => resp.url().includes('/api/v1/template') && resp.request().method() === 'DELETE');
      await templates.nth(i).locator('.action', { hasText: 'delete' }).click();
      await templates.nth(i).locator('.action', { hasText: 'yes' }).click();
      await deletePromise;
      found = true;
      break;
    }
    if (!found) break;
    templateCount = await templates.count();
  }
}

export async function openSidebar(page: Page) {
  const sidebar = page.locator('.sidebar');
  if (!await sidebar.evaluate(el => el.classList.contains('expanded'))) {
    await sidebar.locator('.row .toggle').click();
  }
}

export async function closeSidebar(page: Page) {
  const sidebar = page.locator('.sidebar');
  if (await sidebar.evaluate(el => el.classList.contains('expanded'))) {
    await sidebar.locator('.row .toggle').click();
  }
}
