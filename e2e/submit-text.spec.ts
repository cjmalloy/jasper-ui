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

  test('resizing the centered comment textarea keeps the grip under the pointer', async () => {
    await page.goto('/submit/text?debug=USER', { waitUntil: 'networkidle' });
    const textarea = page.locator('.fill-editor .editor textarea').first();
    await textarea.click();
    const before = (await textarea.boundingBox())!;
    const x = before.x + before.width - 3;
    const y = before.y + before.height - 3;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 10, y + 5);
    const first = (await textarea.boundingBox())!;
    expect(Math.abs(first.x + first.width - 3 - (x + 10))).toBeLessThan(1);
    await page.mouse.move(x + 150, y + 60, { steps: 5 });
    const during = (await textarea.boundingBox())!;
    expect(Math.abs(during.x + during.width - 3 - (x + 150))).toBeLessThan(3);
    expect(Math.abs(during.y + during.height - 3 - (y + 60))).toBeLessThan(3);
    const edge = page.viewportSize()!.width - 1;
    await page.mouse.move(edge, y + 60, { steps: 5 });
    await page.mouse.up();
    const after = (await textarea.boundingBox())!;
    expect(after.x + after.width).toBeGreaterThan(edge - 6);
  });
});
