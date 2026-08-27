import { expect, test } from '@playwright/test';
import { mod } from './setup';

test.describe.serial('Ext defaults', () => {
  test('enable Ext default mods', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-config\\/home');
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
      response.url().includes('/api/v1/ext') &&
      ['POST', 'PUT'].includes(response.request().method()) &&
      response.ok()
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

  test('removes sidebar default date filters with one click and updates the query', async ({ page }) => {
    await page.goto('/home?debug=ADMIN', { waitUntil: 'networkidle' });
    const filters = page.locator('.filter .controls');
    await expect(filters).toHaveCount(2);

    await page.locator('.filter input[type="datetime-local"]').first().focus();
    const firstRemove = filters.first().locator('.remove-filter');
    const firstRemoveBox = await firstRemove.boundingBox();
    expect(firstRemoveBox).not.toBeNull();
    await page.mouse.click(
      firstRemoveBox!.x + firstRemoveBox!.width / 2,
      firstRemoveBox!.y + firstRemoveBox!.height / 2,
    );

    await expect(filters).toHaveCount(1);
    expect(new URL(page.url()).searchParams.getAll('filter')).toHaveLength(1);

    const unfilteredQuery = page.waitForRequest(request => {
      const url = new URL(request.url());
      return url.pathname.endsWith('/api/v1/ref/page') &&
        url.searchParams.get('size') === '24' &&
        !url.searchParams.has('publishedBefore') &&
        !url.searchParams.has('createdAfter');
    });
    await filters.first().locator('.remove-filter').click();
    await unfilteredQuery;

    await expect(filters).toHaveCount(0);
    const url = new URL(page.url());
    expect(url.searchParams.has('filter')).toBe(true);
    expect(url.searchParams.get('filter')).toBe('');
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
});
