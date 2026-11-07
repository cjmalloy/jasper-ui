import { expect } from '@playwright/test';
import { mod, test } from './setup';

test.describe.serial('Ext defaults', () => {
  test('enable Ext default mods', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-config\\/home', '[id="mod-plugin/duration"]');
    await page.goto('/ext/config/home?debug=ADMIN', { waitUntil: 'networkidle' });
    const deleteButton = page.getByRole('button', { name: 'Delete', exact: true });
    if (await deleteButton.isVisible()) {
      page.once('dialog', dialog => dialog.accept());
      await deleteButton.click();
    }
  });

  test('renders the resizable sidebar editor through Formly', async ({ page }) => {
    await page.goto('/ext/config/home?debug=ADMIN', { waitUntil: 'networkidle' });
    const extend = page.getByRole('button', { name: 'Extend', exact: true });
    const sidebar = page.locator('.sidebar-editor .editor-field');
    await expect(extend.or(sidebar)).toBeVisible();
    if (await extend.isVisible()) await extend.click();

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
    const extend = page.getByRole('button', { name: 'Extend', exact: true });
    const sortCreate = page.locator('.default-sort-create');
    await expect(extend.or(sortCreate)).toBeVisible();
    if (await extend.isVisible()) await extend.click();
    await expect(sortCreate).toBeVisible();

    await expect(page.locator('.default-sort-row')).toHaveCount(1);
    await expect(page.locator('.default-sort-row select')).toHaveValue('published');
    await sortCreate.selectOption('modified');
    await expect(page.locator('.default-sort-row')).toHaveCount(2);

    const filterCreate = page.locator('.default-filter-create');
    await filterCreate.selectOption({ label: '📅️ published before' });
    await filterCreate.selectOption({ label: '✨️ created after' });
    await filterCreate.selectOption('query/public');
    await expect(page.locator('.default-filter-row')).toHaveCount(3);
    const dateFilter = page.locator('.default-filter-row').first();
    const date = dateFilter.locator('input[type="datetime-local"]');
    await date.fill('2026-07-09T12:30');
    await date.blur();
    await page.keyboard.down('Control');
    const range = dateFilter.locator('input[type="range"]');
    await expect(range).toBeVisible();
    await range.fill('2');
    await page.keyboard.up('Control');
    await expect(range).toBeVisible();
    await expect(dateFilter.locator('.default-filter-date-range output')).toHaveText('15 minutes ago');
    await expect(page.locator('.default-filter-row').nth(1).locator('input[type="datetime-local"]')).toBeVisible();
    const queryFilter = page.locator('.default-filter-row').last();
    const queryFilterOption = queryFilter.locator('option:checked');
    const queryFilterLabel = await queryFilterOption.textContent();
    const negate = queryFilter.locator('.default-filter-negate');
    const negateSymbol = await negate.textContent();
    await negate.click();
    await expect(queryFilter.locator('select')).toHaveValue('query/!(public)');
    await expect(queryFilterOption).toHaveText(negateSymbol! + queryFilterLabel!);
    await queryFilter.locator('select').selectOption('query/public');
    await expect(queryFilter.locator('select')).toHaveValue('query/public');
    await negate.click();
    await expect(queryFilter.locator('select')).toHaveValue('query/!(public)');

    const save = page.waitForResponse(response => (
      response.url().includes('/api/v1/ext') &&
      ['POST', 'PUT'].includes(response.request().method()) &&
      response.ok()
    ));
    await page.locator('button', { hasText: 'Save' }).click();
    const saveResponse = await save;
    expect(saveResponse.request().postDataJSON().config.defaultFilter).toContain('query/!(public)');

    await page.goto('/ext/config/home?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('.default-sort-row select').first()).toHaveValue('published');
    await expect(page.locator('.default-sort-row select').nth(1)).toHaveValue('modified');
    await expect(page.locator('.default-filter-row select').first()).toHaveValue(/^published\/before\//);
    await expect(page.locator('.default-filter-row select').nth(1)).toHaveValue(/^created\/after\//);
    await expect(page.locator('.default-filter-row select').nth(2)).toHaveValue('query/!(public)');

    await page.goto('/home?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('.sort .controls')).toHaveCount(2);
    await expect(page.locator('.filter .controls')).toHaveCount(3);
  });

  test('configures and loads a default value filter', async ({ page }) => {
    await page.goto('/ext/config/home?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('.default-filter-create').selectOption({ label: '⏱️ shorter than' });
    const row = page.locator('.default-filter-row').last();
    await expect(row.locator('.filter-range-label')).toHaveText('5 min');
    await row.locator('.filter-range').press('ArrowRight');
    await expect(row.locator('.filter-range-label')).not.toHaveText('5 min');
    const label = await row.locator('.filter-range-label').textContent();
    await row.locator('select').selectOption({ label: '⏱️ longer than' });
    await expect(row.locator('select')).toHaveValue(/^tags->plugin\/duration:dur\/after\//);
    await expect(row.locator('.filter-range-label')).toHaveText(label!);

    const save = page.waitForResponse(response => (
      response.url().includes('/api/v1/ext') &&
      ['POST', 'PUT'].includes(response.request().method()) &&
      response.ok()
    ));
    await page.locator('button', { hasText: 'Save' }).click();
    const saveResponse = await save;
    const saved: string[] = saveResponse.request().postDataJSON().config.defaultFilter;
    const value = saved.find(f => f.startsWith('tags->plugin/duration:dur/after/'))!.replace('tags->plugin/duration:dur/after/', '');
    expect(value).toMatch(/^pt/);
    expect(value).not.toBe('pt5m');

    await page.goto('/ext/config/home?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('.default-filter-row select').last()).toHaveValue(/^tags->plugin\/duration:dur\/after\//);
    await expect(page.locator('.default-filter-row .filter-range-label').last()).toHaveText(label!);

    const request = page.waitForRequest(req => req.url().includes('/api/v1/ref/page') && req.url().includes('filter='));
    await page.goto('/home?debug=ADMIN');
    expect(new URL((await request).url()).searchParams.getAll('filter')).toEqual([
      expect.stringMatching(/^published\/before\//),
      expect.stringMatching(/^created\/after\//),
      'tags->plugin/duration:dur/after/' + value,
    ]);
  });

  test('configures and renders a Markdown header', async ({ page }) => {
    await page.goto('/ext/config/home?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '+ Add header' }).click();
    await page.locator('.header-editor textarea').fill('# Home header');

    const save = page.waitForResponse(response => (
      response.url().includes('/api/v1/ext') &&
      ['POST', 'PUT'].includes(response.request().method()) &&
      response.ok()
    ));
    await page.getByRole('button', { name: 'Save' }).click();
    await save;

    await page.goto('/home?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.lens-header h1')).toHaveText('Home header');
  });

  test('asks to discard the draft after editing a default date filter', async ({ page }) => {
    await page.goto('/ext/config/home?debug=ADMIN', { waitUntil: 'networkidle' });
    const range = page.locator('.default-filter-row .relative-date-range').first();
    await expect(range).toBeVisible();
    await range.press('End');
    await expect(page.locator('.default-filter-date-range output').first()).toHaveText('100 years ago');

    const dialogs: string[] = [];
    page.once('dialog', dialog => {
      dialogs.push(dialog.message());
      return dialog.dismiss();
    });
    await page.locator('a.logo').click();
    await expect.poll(() => dialogs).toEqual(['Discard draft?']);
    await expect(page).toHaveURL(/\/ext\/config\/home/);
  });
});
