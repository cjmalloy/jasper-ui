import { type Dialog, expect, type Page } from '@playwright/test';
import { mod, openTextSubmit, test } from './setup';

test.describe.serial('Submit Text', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('enable mods', async () => {
    await mod(page, '#mod-todolist');
  });

  test('adds a plugin from the dropdown without prompting to discard the draft', async () => {
    const dialogs: string[] = [];
    const onDialog = (dialog: Dialog) => {
      dialogs.push(dialog.message());
      return dialog.dismiss();
    };
    page.on('dialog', onDialog);
    try {
      await page.goto('/?debug=USER', { waitUntil: 'networkidle' });
      await openTextSubmit(page, '+user/debug');
      await page.locator('[name=title]').fill('Draft With Plugin');
      await page.locator('select:has(option[value="plugin/todo"])').selectOption('plugin/todo');
      await expect(page).toHaveURL(/tag=plugin(%2F|\/)todo/);
      await expect(page.locator('[name=title]')).toHaveValue('Draft With Plugin');
      expect(dialogs).toEqual([]);
    } finally {
      page.off('dialog', onDialog);
    }
  });
});
