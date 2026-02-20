import { expect, test } from '@playwright/test';
import { mod } from './setup';

test.describe.serial('Bookmark Formly Type', () => {

  test('enable user mod', async ({ page }) => {
    await mod(page, '#mod-user');
  });

  test('renders filter-toggle in preview', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkField = page.locator('.bookmark-field').last();
    // type a value and blur to enter preview mode so breadcrumbs (and filter-toggle) are visible
    await bookmarkField.locator('input.grow:not(.preview)').fill('science');
    await bookmarkField.locator('input.grow:not(.preview)').blur();
    await expect(bookmarkField.locator('.filter-toggle')).toBeVisible();
    await expect(bookmarkField.locator('.filter-toggle')).toContainText('🪄️');
  });

  test('clicking filter-toggle opens params popup', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkField = page.locator('.bookmark-field').last();
    await bookmarkField.locator('.filter-toggle').click({ force: true });
    const popup = page.locator('.params-panel');
    await expect(popup).toBeVisible();
    await expect(popup.locator('input[type="search"]')).toBeVisible();
    await expect(popup.locator('select.big').first()).toContainText('🔼️ sort');
    await expect(popup.locator('select.big').last()).toContainText('🪄️ filter');
  });

  test('clicking outside popup closes it', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkField = page.locator('.bookmark-field').last();
    await bookmarkField.locator('.filter-toggle').click({ force: true });
    await expect(page.locator('.params-panel')).toBeVisible();
    await page.locator('label', { hasText: 'Bookmarks' }).first().click({ force: true });
    await expect(page.locator('.params-panel')).not.toBeVisible();
  });

  test('adds a sort from the sort placeholder select', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkField = page.locator('.bookmark-field').last();
    await bookmarkField.locator('.filter-toggle').click({ force: true });
    const popup = page.locator('.params-panel');
    await popup.locator('select.big').first().selectOption('published');
    const sortRow = popup.locator('.controls').first();
    await expect(sortRow).toBeVisible();
    await expect(sortRow.locator('select')).toContainText('published');
  });

  test('removes a sort via the minus button', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkField = page.locator('.bookmark-field').last();
    await bookmarkField.locator('.filter-toggle').click({ force: true });
    const popup = page.locator('.params-panel');
    await popup.locator('select.big').first().selectOption('published');
    await expect(popup.locator('.controls')).toHaveCount(1);
    await popup.locator('.controls button', { hasText: '–' }).first().click();
    await expect(popup.locator('.controls')).toHaveCount(0);
  });

  test('sort remove button is visible even for a single sort', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkField = page.locator('.bookmark-field').last();
    await bookmarkField.locator('.filter-toggle').click({ force: true });
    const popup = page.locator('.params-panel');
    await popup.locator('select.big').first().selectOption('published');
    await expect(popup.locator('.controls button', { hasText: '–' }).first()).toBeVisible();
  });

  test('adds a filter from the filter placeholder select', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkField = page.locator('.bookmark-field').last();
    await bookmarkField.locator('.filter-toggle').click({ force: true });
    const popup = page.locator('.params-panel');
    await popup.locator('select.big').last().selectOption('obsolete');
    const filterRow = popup.locator('.controls').first();
    await expect(filterRow).toBeVisible();
    await expect(filterRow.locator('select')).toContainText('obsolete');
  });

  test('removes a filter via the minus button', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkField = page.locator('.bookmark-field').last();
    await bookmarkField.locator('.filter-toggle').click({ force: true });
    const popup = page.locator('.params-panel');
    await popup.locator('select.big').last().selectOption('obsolete');
    await expect(popup.locator('.controls')).toHaveCount(1);
    await popup.locator('.controls button', { hasText: '–' }).first().click();
    await expect(popup.locator('.controls')).toHaveCount(0);
  });

  test('search field accepts input', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkField = page.locator('.bookmark-field').last();
    await bookmarkField.locator('.filter-toggle').click({ force: true });
    const popup = page.locator('.params-panel');
    await popup.locator('input[type="search"]').fill('hello world');
    await expect(popup.locator('input[type="search"]')).toHaveValue('hello world');
  });

  test('filter-preview appears in preview after adding sort', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkField = page.locator('.bookmark-field').last();
    await bookmarkField.locator('input.grow:not(.preview)').fill('science');
    await bookmarkField.locator('.filter-toggle').click({ force: true });
    const popup = page.locator('.params-panel');
    await popup.locator('select.big').first().selectOption('published');
    // close popup by clicking outside, then blur input to enter preview mode
    await page.locator('label', { hasText: 'Bookmarks' }).first().click({ force: true });
    await expect(page.locator('.params-panel')).not.toBeVisible();
    await bookmarkField.locator('input.grow:not(.preview)').blur();
    await expect(bookmarkField.locator('.filter-preview')).toBeVisible();
    await expect(bookmarkField.locator('.filter-preview')).toContainText('published');
  });

  test('focused input shows full value including ?params', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkField = page.locator('.bookmark-field').last();
    const textInput = bookmarkField.locator('input.grow:not(.preview)');
    await textInput.fill('science');
    await bookmarkField.locator('.filter-toggle').click({ force: true });
    await page.locator('.params-panel').locator('select.big').first().selectOption('published');
    // close popup by clicking outside, then click input to check full value
    await page.locator('label', { hasText: 'Bookmarks' }).first().click({ force: true });
    await textInput.click({ force: true });
    const value = await textInput.inputValue();
    expect(value).toMatch(/science\?sort=published/);
  });

  test('params are not percent-encoded for readable characters', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkField = page.locator('.bookmark-field').last();
    const textInput = bookmarkField.locator('input.grow:not(.preview)');
    await textInput.fill('science');
    await bookmarkField.locator('.filter-toggle').click({ force: true });
    await page.locator('.params-panel').locator('select.big').last().selectOption('obsolete');
    // close popup by clicking outside, then click input to check full value
    await page.locator('label', { hasText: 'Bookmarks' }).first().click({ force: true });
    await textInput.click({ force: true });
    const value = await textInput.inputValue();
    expect(value).toContain('filter=obsolete');
    expect(value).not.toContain('%3D');
  });
});
