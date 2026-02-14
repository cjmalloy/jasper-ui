import { expect, type Page } from '@playwright/test';

export async function clearMods(page: Page, base = '') {
  await page.goto(base + '/settings/plugin?debug=ADMIN&pageSize=2000', { waitUntil: 'networkidle' });
  const plugins = page.locator('.list-container .plugin:not(.deleted)');
  while (await plugins.count() > 0) {
    const deletePromise = page.waitForResponse(resp => resp.url().includes('/api/v1/plugin') && resp.request().method() === 'DELETE');
    await plugins.first().locator('.action .fake-link', { hasText: 'delete' }).click();
    await page.waitForLoadState('networkidle');
    await plugins.first().locator('.action .fake-link', { hasText: 'yes' }).click();
    await deletePromise;
    await page.waitForLoadState('networkidle');
  }
  await page.goto(base + '/settings/template?debug=ADMIN&pageSize=2000', { waitUntil: 'networkidle' });
  const templates = page.locator('.list-container .template:not(.deleted):not(.config_index):not(.config_server)');
  while (await templates.count() > 0) {
    const deletePromise = page.waitForResponse(resp => resp.url().includes('/api/v1/template') && resp.request().method() === 'DELETE');
    await templates.first().locator('.action .fake-link', { hasText: 'delete' }).click();
    await page.waitForLoadState('networkidle');
    await templates.first().locator('.action .fake-link', { hasText: 'yes' }).click();
    await deletePromise;
    await page.waitForLoadState('networkidle');
  }
}

export async function clearAll(page: Page, base = '', origin  = '') {
  await page.goto(base + '/settings/backup?debug=ADMIN', { waitUntil: 'networkidle' });
  if (await page.locator('form select').locator('option', { hasText: origin || 'default'}).count() === 0) return;
  await page.locator('form select').selectOption(origin);
  page.once('dialog', dialog => dialog.accept(origin || 'default'));
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

export async function mod(page: Page, ...mods: string[]) {
  await modRemote(page, '', ...mods);
}

export async function modRemote(page: Page, base = '', ...mods: string[]) {
  await clearMods(page, base);
  await page.goto(base + '/?debug=ADMIN', { waitUntil: 'networkidle' });
  await page.locator('.settings a', { hasText: 'settings' }).click();
  await page.locator('.tabs a', { hasText: 'setup' }).first().click();
  if (mods.includes('#mod-experiments')) {
    await expect(page.locator('#mod-experiments')).toBeChecked({ checked: false });
    await page.locator('#mod-experiments').check();
    await page.locator('button', { hasText: 'Save' }).click();
    await page.locator('.log div', { hasText: 'Success.' }).first().waitFor({ timeout: 15_000, state: 'attached' });
    await page.goto(base + '/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
  }
  for (const mod of mods) {
    if (mod === '#mod-experiments') continue;
    await expect(page.locator(mod)).toBeChecked({ checked: false });
    await page.locator(mod).check();
  }
  await page.locator('button', { hasText: 'Save' }).click();
  await page.locator('.log div', { hasText: 'Success.' }).first().waitFor({ timeout: 15_000, state: 'attached' });
  await page.goto(base + '/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
  for (const mod of mods) {
    await expect(page.locator(mod)).toBeChecked();
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

export async function upload(page: Page, file: string) {
  await page.goto('/?debug=USER', { waitUntil: 'networkidle' });
  await openSidebar(page);
  await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
  await page.locator('.tabs a', { hasText: 'upload' }).click();
  await expect(page.locator('button', { hasText: '+ cache' })).toBeVisible({ timeout: 10_000 });
  const fileInput = page.locator('input[type="file"]').nth(1);
  await fileInput.setInputFiles(file);
  await page.locator('.ref .actions .fake-link', { hasText: 'upload' }).click();
  await expect(page.locator('.full-page.ref .link a')).toContainText(
    file.substring(file.lastIndexOf('/') + 1),
    { timeout: 10_000 },
  );
  return page.url().replace('/ref/', '/ref/e/');
}

export async function pollNotifications(page: Page, user = 'debug') {
  await pollRemoteNotifications(page, '', user);
}

export async function pollRemoteNotifications(page: Page, base = '', user = 'debug') {
  const path = base + `/?debug=ADMIN&tag=${user}`;
  await page.goto(path, { waitUntil: 'networkidle' });
  await expect.poll(async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.goto(path, { waitUntil: 'networkidle' });
    return await page.locator('.settings .notification').isVisible();
  }, { timeout: 60_000 }).toBe(true);
}
