import { expect, test } from '@playwright/test';
import { mod } from './setup';

test.describe.serial('Ext defaults', () => {
  test('enable Ext default mods', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-config\\/home');
  });

  test('renders the resizable sidebar editor through Formly', async ({ page }) => {
    await page.goto('/ext/config/home?debug=ADMIN', { waitUntil: 'networkidle' });
    const extend = page.getByRole('button', { name: 'Extend', exact: true });
    if (await extend.isVisible()) await extend.click();

    const sidebar = page.locator('.sidebar-editor .editor-field');
    await expect(sidebar).toBeVisible();
    const editor = sidebar.locator('textarea');
    await expect(editor).toBeVisible();
    await expect.poll(async () => {
      const { editorWidth, containerWidth } = await editor.evaluate(element => ({
        editorWidth: element.getBoundingClientRect().width,
        containerWidth: element.closest('.fill-editor')!.getBoundingClientRect().width,
      }));
      return Math.abs(editorWidth - containerWidth);
    }).toBeLessThan(40);
  });

  test('configures and loads multiple default sorts and date filters', async ({ page }) => {
    await page.goto('/ext/config/home?debug=ADMIN', { waitUntil: 'networkidle' });

    const sortCreate = page.locator('.default-sort-create');
    await sortCreate.selectOption('published');
    await sortCreate.selectOption('modified');
    await expect(page.locator('.default-sort-row')).toHaveCount(2);

    const filterCreate = page.locator('.default-filter-create');
    await filterCreate.selectOption({ label: '📅️ published before' });
    await filterCreate.selectOption({ label: '✨️ created after' });
    await expect(page.locator('.default-filter-row')).toHaveCount(2);
    await page.locator('.default-filter-row input[type="datetime-local"]').first().fill('2026-07-09T12:30');
    await page.keyboard.down('Control');
    const range = page.locator('.default-filter-row input[type="range"]').first();
    await expect(range).toBeVisible();
    await range.fill('2');
    await page.keyboard.up('Control');
    await expect(range).toBeVisible();
    await expect(page.locator('.default-filter-date-range output').first()).toHaveText('15 minutes');

    const save = page.waitForResponse(response => (
      response.url().includes('/api/v1/ext') && response.request().method() === 'POST' && response.ok()
    ));
    await page.locator('button', { hasText: 'Save' }).click();
    await save;

    await page.goto('/ext/config/home?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('.default-sort-row select').first()).toHaveValue('published');
    await expect(page.locator('.default-sort-row select').nth(1)).toHaveValue('modified');
    await expect(page.locator('.default-filter-row select').first()).toHaveValue(/^published\/before\//);
    await expect(page.locator('.default-filter-row select').nth(1)).toHaveValue(/^created\/after\//);

    await page.goto('/home?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('.sort .controls')).toHaveCount(2);
    await expect(page.locator('.filter .controls')).toHaveCount(2);
  });
});
