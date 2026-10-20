import { expect, type Page } from '@playwright/test';
import { mod, openSidebar, test } from './setup';

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
    await page.waitForURL(/\/tag\/kanban\/bookmark\/filter/, { timeout: 10_000 });
    await expect(page.locator('h2')).toHaveText('Bookmark Filter Kanban');
  }

  test('renders filter-toggle in preview', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    const bookmarkField = await addBookmark(page, 'science');
    await expect(bookmarkField.locator('.filter-toggle')).toBeVisible();
    await expect(bookmarkField.locator('.filter-toggle')).toContainText('🪄️');
  });

  test('admin with blank tag can open my settings', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN&tag=', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/settings\/me(\?|$)/);
    await expect(page).not.toHaveURL(/\/settings\/setup(\?|$)/);
    await expect(page.locator('.tabs a', { hasText: 'me' })).toHaveClass(/current-tab/);
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
    const groups = await filterSelect.locator('optgroup').evaluateAll(elements => (
      elements.map(group => group.getAttribute('label') || '')
    ));
    const filtersIndex = groups.indexOf('Filters 🕵️️');
    const kanbanIndex = groups.indexOf('Kanban 📋️');
    expect(filtersIndex).not.toBe(-1);
    expect(kanbanIndex).not.toBe(-1);
    expect(filtersIndex).toBeLessThan(kanbanIndex);
    const originsIndex = groups.indexOf('Origins 🏛️');
    if (originsIndex !== -1) expect(kanbanIndex).toBeLessThan(originsIndex);
  });

  test('fills the ext form with template config in one step', async ({ page }) => {
    await page.goto('/ext/kanban/bookmark/filter?debug=MOD', { waitUntil: 'networkidle' });
    await expect(page.locator('[name=name]')).toHaveValue('Bookmark Filter Kanban');
    await expect(page.locator('[name=showColumnBacklog]')).toBeChecked();
    await expect(page.locator('[name=columnBacklogTitle]')).toHaveValue('todo');
    await expect(page.locator('.columns input.grow.preview')).toHaveCount(2);
  });

  test('keeps a hidden ext draft in a list', async ({ page }) => {
    await page.goto('/tags/kanban?debug=MOD', { waitUntil: 'networkidle' });
    const ext = page.locator('.ext', { has: page.getByRole('link', { name: 'Bookmark Filter Kanban' }) });
    const edit = ext.locator('.actions .fake-link', { hasText: /^\*?edit\*?$/ });
    await edit.click();
    await expect(ext.locator('[name=columnBacklogTitle]')).toHaveValue('todo');
    await ext.locator('[name=columnBacklogTitle]').fill('backlog');
    await ext.locator('[name=name]').fill('Draft Kanban');
    await ext.locator('.columns button').first().click();
    const columns = ext.locator('.columns input.grow:not(.preview)');
    const columnValues = () => ext.locator('.columns input.grow').evaluateAll(es => es.map(e => (e as HTMLInputElement).value));
    await columns.last().fill('review');
    await columns.last().press('Enter');
    await expect.poll(columnValues).toContain('review');
    await edit.click();
    await expect(ext.locator('[name=columnBacklogTitle]')).toHaveCount(0);
    await expect(ext.locator('.actions .fake-link', { hasText: '*edit*' })).toBeVisible();
    await edit.click();
    await expect(ext.locator('[name=columnBacklogTitle]')).toHaveValue('backlog');
    await expect(ext.locator('[name=name]')).toHaveValue('Draft Kanban');
    await expect.poll(columnValues).toContain('review');
    await ext.locator('button', { hasText: 'cancel' }).click();
    await expect(ext.locator('.actions .fake-link', { hasText: '*edit*' })).toHaveCount(0);
  });

  test('keeps an ext draft when the list reloads with remote edits', async ({ page, browser }) => {
    await page.goto('/tags/kanban?debug=MOD', { waitUntil: 'networkidle' });
    const ext = page.locator('.ext').filter({ has: page.locator('.link a[href$="/tag/kanban/bookmark/filter"]') });
    const edit = ext.locator('.actions .fake-link', { hasText: /^\*?edit\*?$/ });
    await edit.click();
    await ext.locator('[name=columnBacklogTitle]').fill('backlog');
    await edit.click();
    await expect(ext.locator('.actions .fake-link', { hasText: '*edit*' })).toBeVisible();

    const origin = new URL(page.url()).origin;
    const renameExt = async (name: string) => {
      const updaterContext = await browser.newContext();
      const updater = await updaterContext.newPage();
      try {
        await updater.goto(`${origin}/ext/kanban/bookmark/filter?debug=MOD`, { waitUntil: 'networkidle' });
        await updater.locator('[name=name]').fill(name);
        const saved = updater.waitForResponse(response => response.url().includes('/api/v1/ext') && response.request().method() === 'PUT' && response.ok());
        await updater.locator('button', { hasText: 'save' }).click();
        await saved;
      } finally {
        await updaterContext.close();
      }
    };
    await renameExt('Remote Kanban');

    const search = page.locator('.search input[type=search]');
    await search.fill('Kanban');
    await search.press('Enter');
    await expect(page).toHaveURL(/search=Kanban/);
    await expect(ext.locator('.info .remote-edits')).toBeVisible();
    await expect(ext.locator('.link a').first()).toContainText('Bookmark Filter Kanban');
    await edit.click();
    await expect(ext.locator('[name=columnBacklogTitle]')).toHaveValue('backlog');
    await expect(ext.locator('[name=name]')).toHaveValue('Bookmark Filter Kanban');

    await ext.locator('button', { hasText: 'cancel' }).click();
    await expect(ext.locator('.link a').first()).toContainText('Remote Kanban');
    await expect(ext.locator('.info .remote-edits')).toHaveCount(0);
    await edit.click();
    await expect(ext.locator('[name=columnBacklogTitle]')).toHaveValue('todo');
    await expect(ext.locator('[name=name]')).toHaveValue('Remote Kanban');
    await ext.locator('button', { hasText: 'cancel' }).click();

    await renameExt('Bookmark Filter Kanban');
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
