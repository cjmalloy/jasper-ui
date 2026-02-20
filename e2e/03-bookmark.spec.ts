import { expect, test } from '@playwright/test';
import { mod } from './setup';

test.describe.serial('Bookmark Formly Type', () => {

  test('enable user mod', async ({ page }) => {
    await mod(page, '#mod-user');
  });

  test('renders bookmark field with wand in preview', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkRow = page.locator('formly-field-bookmark-input').last();
    // The wand is visible in the preview span
    await expect(bookmarkRow.locator('.wand')).toBeVisible();
    await expect(bookmarkRow.locator('.wand')).toContainText('🪄️');
  });

  test('clicking wand opens params popup', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkRow = page.locator('formly-field-bookmark-input').last();
    await bookmarkRow.locator('.wand').click();
    // Popup should be visible with search, sort, and filter controls
    const popup = page.locator('.params-panel');
    await expect(popup).toBeVisible();
    await expect(popup.locator('input[type="search"]')).toBeVisible();
    await expect(popup.locator('select.big').first()).toContainText('🔼️ sort');
    await expect(popup.locator('select.big').last()).toContainText('🪄️ filter');
  });

  test('clicking outside popup closes it', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkRow = page.locator('formly-field-bookmark-input').last();
    await bookmarkRow.locator('.wand').click();
    await expect(page.locator('.params-panel')).toBeVisible();
    // Click outside the popup to close it
    await page.locator('h1, h2, h3, label', { hasText: 'Bookmarks' }).first().click({ force: true });
    await expect(page.locator('.params-panel')).not.toBeVisible();
  });

  test('adds a sort from the sort placeholder select', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkRow = page.locator('formly-field-bookmark-input').last();
    await bookmarkRow.locator('.wand').click();
    const popup = page.locator('.params-panel');
    // Select 'published' from the sort placeholder select
    await popup.locator('select.big').first().selectOption('published');
    // A sort row with a select and direction button should appear
    const sortRow = popup.locator('.controls').first();
    await expect(sortRow).toBeVisible();
    await expect(sortRow.locator('select')).toContainText('published');
  });

  test('removes a sort via the minus button', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkRow = page.locator('formly-field-bookmark-input').last();
    await bookmarkRow.locator('.wand').click();
    const popup = page.locator('.params-panel');
    await popup.locator('select.big').first().selectOption('published');
    await expect(popup.locator('.controls')).toHaveCount(1);
    // Click the '–' button to remove the sort
    await popup.locator('.controls button', { hasText: '–' }).first().click();
    await expect(popup.locator('.controls')).toHaveCount(0);
  });

  test('sort remove button is visible even for a single sort', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkRow = page.locator('formly-field-bookmark-input').last();
    await bookmarkRow.locator('.wand').click();
    const popup = page.locator('.params-panel');
    await popup.locator('select.big').first().selectOption('published');
    // '–' button must be visible for single sort (unlike the sidebar)
    await expect(popup.locator('.controls button', { hasText: '–' }).first()).toBeVisible();
  });

  test('adds a filter from the filter placeholder select', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkRow = page.locator('formly-field-bookmark-input').last();
    await bookmarkRow.locator('.wand').click();
    const popup = page.locator('.params-panel');
    // Select 'obsolete' from the filter placeholder select
    await popup.locator('select.big').last().selectOption('obsolete');
    const filterRow = popup.locator('.controls').first();
    await expect(filterRow).toBeVisible();
    await expect(filterRow.locator('select')).toContainText('obsolete');
  });

  test('removes a filter via the minus button', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkRow = page.locator('formly-field-bookmark-input').last();
    await bookmarkRow.locator('.wand').click();
    const popup = page.locator('.params-panel');
    await popup.locator('select.big').last().selectOption('obsolete');
    await expect(popup.locator('.controls')).toHaveCount(1);
    await popup.locator('.controls button', { hasText: '–' }).first().click();
    await expect(popup.locator('.controls')).toHaveCount(0);
  });

  test('search field accepts input', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkRow = page.locator('formly-field-bookmark-input').last();
    await bookmarkRow.locator('.wand').click();
    const popup = page.locator('.params-panel');
    await popup.locator('input[type="search"]').fill('hello world');
    await expect(popup.locator('input[type="search"]')).toHaveValue('hello world');
  });

  test('params summary appears in preview after adding sort', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkRow = page.locator('formly-field-bookmark-input').last();
    // Type a query first
    await bookmarkRow.locator('input.grow:not(.preview)').fill('science');
    await bookmarkRow.locator('.wand').click();
    const popup = page.locator('.params-panel');
    await popup.locator('select.big').first().selectOption('published');
    // Close popup by pressing Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('.params-panel')).not.toBeVisible();
    // Preview should show param summary with direction emoji and sort label
    await expect(bookmarkRow.locator('.param')).toBeVisible();
    await expect(bookmarkRow.locator('.param')).toContainText('published');
  });

  test('focused input shows full value including ?params', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkRow = page.locator('formly-field-bookmark-input').last();
    const textInput = bookmarkRow.locator('input.grow:not(.preview)');
    // Type a query, add a sort via the wand
    await textInput.fill('science');
    await bookmarkRow.locator('.wand').click();
    await page.locator('.params-panel').locator('select.big').first().selectOption('published');
    await page.keyboard.press('Escape');
    // Focus the input — it should show the full value with ?sort=...
    await textInput.click();
    const value = await textInput.inputValue();
    expect(value).toMatch(/science\?sort=published/);
  });

  test('params are not percent-encoded for readable characters', async ({ page }) => {
    await page.goto('/settings/me?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add another bookmark' }).click();
    const bookmarkRow = page.locator('formly-field-bookmark-input').last();
    const textInput = bookmarkRow.locator('input.grow:not(.preview)');
    await textInput.fill('science');
    await bookmarkRow.locator('.wand').click();
    await page.locator('.params-panel').locator('select.big').last().selectOption('obsolete');
    await page.keyboard.press('Escape');
    await textInput.click();
    const value = await textInput.inputValue();
    // filter value 'obsolete' should not be percent-encoded
    expect(value).toContain('filter=obsolete');
    expect(value).not.toContain('%3D');
  });
});
