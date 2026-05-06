import { expect, type Page, test } from '@playwright/test';
import { mod, openSidebar } from './setup';

test.describe.serial('Bookmark Formly Type', () => {

  test('enable bookmark form mods', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-user', '#mod-kanban');
  });

  /** Helper: add a bookmark, blur the input so breadcrumbs/filter-toggle are visible.
   *  A non-empty query is required so the field enters preview mode after blur. */
  async function addBookmark(page: Page, query = 'science') {
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkField = page.locator('.bookmark-field').last();
    const textInput = bookmarkField.locator('input.grow:not(.preview)');
    if (query) await textInput.fill(query);
    // blur to enter preview mode so .breadcrumbs (and .filter-toggle) become visible
    await textInput.blur();
    return bookmarkField;
  }

  async function createKanbanBoard(page: Page) {
    await page.goto('/ext/kanban/bookmark/filter?debug=MOD', { waitUntil: 'networkidle' });
    const deleteBtn = page.locator('button', { hasText: 'Delete' });
    if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      page.once('dialog', dialog => dialog.accept());
      await deleteBtn.click();
      await page.waitForURL(/\/tag\//, { timeout: 5_000 });
    }
    await page.goto('/tags/kanban?debug=MOD', { waitUntil: 'networkidle' });
    await openSidebar(page);
    await page.getByText('Extend').click();
    await page.locator('[name=tag]').fill('bookmark/filter');
    await page.locator('button', { hasText: 'Extend' }).click();
    await expect(page.locator('.columns')).toBeVisible({ timeout: 15_000 });
    await page.locator('[name=name]').fill('Bookmark Filter Kanban');
    await page.locator('.columns button').first().click();
    const columnInputs = page.locator('.columns input.grow:not(.preview)');
    await expect(columnInputs).toHaveCount(1);
    await columnInputs.first().fill('doing');
    await columnInputs.first().press('Enter');
    await expect(columnInputs).toHaveCount(2);
    await columnInputs.last().fill('done');
    await columnInputs.last().press('Enter');
    await page.locator('[name=showColumnBacklog]').check();
    await page.locator('[name=columnBacklogTitle]').fill('todo');
    await page.locator('button', { hasText: 'Save' }).click();
    await expect(page.locator('h2')).toHaveText('Bookmark Filter Kanban');
  }

  test('renders filter-toggle in preview', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    const bookmarkField = await addBookmark(page, 'science');
    await expect(bookmarkField.locator('.filter-toggle')).toBeVisible();
    await expect(bookmarkField.locator('.filter-toggle')).toContainText('🪄️');
  });

  test('clicking filter-toggle opens params popup', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    const bookmarkField = await addBookmark(page);
    await bookmarkField.locator('.filter-toggle').click();
    const popup = page.locator('.params-panel');
    await expect(popup).toBeVisible();
    await expect(popup.locator('input[type="search"]')).toBeVisible();
    await expect(popup.locator('select.big').first()).toContainText('🔼️ sort');
    await expect(popup.locator('select.big').last()).toContainText('🪄️ filter');
  });

  test('shows kanban filters for bookmark query top-level and', async ({ page }) => {
    await createKanbanBoard(page);
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    const bookmarkField = await addBookmark(page, 'public:kanban/bookmark/filter');
    await bookmarkField.locator('.filter-toggle').click();
    const filterSelect = page.locator('.params-panel').locator('select.big').last();
    await expect(filterSelect.locator('option[value="query/doing"]')).toHaveText(/doing/);
    await expect(filterSelect.locator('option[value="query/done"]')).toHaveText(/done/);
    await expect(filterSelect.locator('option[value="query/!doing:!done"]')).toHaveText(/todo/);
    const groups = await filterSelect.locator('optgroup').evaluateAll(elements => elements.map(group => group.getAttribute('label')));
    expect(groups.indexOf('Filters 🕵️️')).toBeLessThan(groups.indexOf('Kanban 📋️'));
    expect(groups.indexOf('Kanban 📋️')).toBeLessThan(groups.indexOf('Origins 🏛️'));
  });

  test('clicking outside popup closes it', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    const bookmarkField = await addBookmark(page);
    await bookmarkField.locator('.filter-toggle').click();
    await expect(page.locator('.params-panel')).toBeVisible();
    await page.locator('label', { hasText: 'Bookmarks' }).first().click();
    await expect(page.locator('.params-panel')).not.toBeVisible();
  });

  test('adds a sort from the sort placeholder select', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    const bookmarkField = await addBookmark(page);
    await bookmarkField.locator('.filter-toggle').click();
    const popup = page.locator('.params-panel');
    await popup.locator('select.big').first().selectOption('published');
    const sortRow = popup.locator('.controls').first();
    await expect(sortRow).toBeVisible();
    await expect(sortRow.locator('select')).toContainText('published');
  });

  test('removes a sort via the minus button', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    const bookmarkField = await addBookmark(page);
    await bookmarkField.locator('.filter-toggle').click();
    const popup = page.locator('.params-panel');
    await popup.locator('select.big').first().selectOption('published');
    await expect(popup.locator('.controls')).toHaveCount(1);
    await popup.locator('.controls button', { hasText: '–' }).first().click();
    await expect(popup.locator('.controls')).toHaveCount(0);
  });

  test('sort remove button is visible even for a single sort', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    const bookmarkField = await addBookmark(page);
    await bookmarkField.locator('.filter-toggle').click();
    const popup = page.locator('.params-panel');
    await popup.locator('select.big').first().selectOption('published');
    await expect(popup.locator('.controls button', { hasText: '–' }).first()).toBeVisible();
  });

  test('adds a filter from the filter placeholder select', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    const bookmarkField = await addBookmark(page);
    await bookmarkField.locator('.filter-toggle').click();
    const popup = page.locator('.params-panel');
    await popup.locator('select.big').last().selectOption('obsolete');
    const filterRow = popup.locator('.controls').first();
    await expect(filterRow).toBeVisible();
    await expect(filterRow.locator('select')).toContainText('obsolete');
  });

  test('removes a filter via the minus button', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    const bookmarkField = await addBookmark(page);
    await bookmarkField.locator('.filter-toggle').click();
    const popup = page.locator('.params-panel');
    await popup.locator('select.big').last().selectOption('obsolete');
    await expect(popup.locator('.controls')).toHaveCount(1);
    await popup.locator('.controls button', { hasText: '–' }).first().click();
    await expect(popup.locator('.controls')).toHaveCount(0);
  });

  test('search field accepts input', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    const bookmarkField = await addBookmark(page);
    await bookmarkField.locator('.filter-toggle').click();
    const popup = page.locator('.params-panel');
    await popup.locator('input[type="search"]').fill('hello world');
    await expect(popup.locator('input[type="search"]')).toHaveValue('hello world');
  });

  test('filter-preview appears in preview after adding sort', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    const bookmarkField = await addBookmark(page, 'science');
    await bookmarkField.locator('.filter-toggle').click();
    const popup = page.locator('.params-panel');
    await popup.locator('select.big').first().selectOption('published');
    // close popup by clicking outside
    await page.locator('label', { hasText: 'Bookmarks' }).first().click();
    await expect(page.locator('.params-panel')).not.toBeVisible();
    // blur input so preview updates
    await bookmarkField.locator('input.grow:not(.preview)').blur();
    await expect(bookmarkField.locator('.filter-preview')).toBeVisible();
    await expect(bookmarkField.locator('.filter-preview')).toContainText('published');
  });

  test('focused input shows full value including ?params', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    const bookmarkField = await addBookmark(page, 'science');
    await bookmarkField.locator('.filter-toggle').click();
    await page.locator('.params-panel').locator('select.big').first().selectOption('published');
    // close popup
    await page.locator('label', { hasText: 'Bookmarks' }).first().click();
    await expect(page.locator('.params-panel')).not.toBeVisible();
    // click breadcrumbs to enter edit mode (breadcrumbs overlay the input in preview mode)
    await bookmarkField.locator('.crumbs-left').click();
    const textInput = bookmarkField.locator('input.grow:not(.preview)');
    const value = await textInput.inputValue();
    expect(value).toMatch(/science\?sort=published/);
  });

  test('params are not percent-encoded for readable characters', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    const bookmarkField = await addBookmark(page, 'science');
    await bookmarkField.locator('.filter-toggle').click();
    await page.locator('.params-panel').locator('select.big').last().selectOption('obsolete');
    // close popup
    await page.locator('label', { hasText: 'Bookmarks' }).first().click();
    await expect(page.locator('.params-panel')).not.toBeVisible();
    // click breadcrumbs to enter edit mode (breadcrumbs overlay the input in preview mode)
    await bookmarkField.locator('.crumbs-left').click();
    const textInput = bookmarkField.locator('input.grow:not(.preview)');
    const value = await textInput.inputValue();
    expect(value).toContain('filter=obsolete');
    expect(value).not.toContain('%3D');
  });
});
