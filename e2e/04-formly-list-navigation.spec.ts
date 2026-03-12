import { expect, type Locator, type Page, test } from '@playwright/test';
import { clearAll, mod, openSidebar } from './setup';

const TEXT_SUBMIT_URL = '/submit/text?tag=public&debug=ADMIN';

type TagListState = {
  activeTagName: string;
  activeValue: string;
  rows: {
    value: string;
    preview: string;
    inputFocused: boolean;
    removeFocused: boolean;
    selectionStart: number | null;
    selectionEnd: number | null;
  }[];
};

function tagList(page: Page) {
  return page.locator('.form-group').filter({
    has: page.getByRole('button', { name: '+ Add another tag' }),
  }).first();
}

async function getTagListState(page: Page): Promise<TagListState> {
  return tagList(page).evaluate(list => {
    const active = document.activeElement;
    return {
      activeTagName: active?.tagName || '',
      activeValue: active instanceof HTMLInputElement ? active.value : active?.textContent?.trim() || '',
      rows: [...list.querySelectorAll('.list-drag')].map(row => {
        const preview = row.querySelector<HTMLInputElement>('input.preview');
        const input = row.querySelector<HTMLInputElement>('input.grow:not(.preview)');
        const remove = row.querySelector<HTMLButtonElement>('button');
        return {
          value: input?.value || '',
          preview: preview?.value || '',
          inputFocused: active === input,
          removeFocused: active === remove,
          selectionStart: active === input ? input.selectionStart : null,
          selectionEnd: active === input ? input.selectionEnd : null,
        };
      }),
    };
  });
}

async function loadTagList(page: Page) {
  await page.goto(TEXT_SUBMIT_URL);
  await expect(tagList(page).getByRole('button', { name: '+ Add another tag' })).toBeVisible();
  // The submit route pre-populates the public tag plus the current debug user tag.
  await expect.poll(async () => (await getTagListState(page)).rows.length).toBeGreaterThanOrEqual(2);
  return await getTagListState(page);
}

async function waitForTagCount(page: Page, count: number) {
  await expect.poll(async () => (await getTagListState(page)).rows.length).toBe(count);
}

async function waitForInputFocus(page: Page, index: number) {
  await expect.poll(async () => (await getTagListState(page)).rows[index]?.inputFocused).toBe(true);
}

async function waitForRemoveFocus(page: Page, index: number) {
  await expect.poll(async () => (await getTagListState(page)).rows[index]?.removeFocused).toBe(true);
}

async function pressShiftTab(page: Page, inputLocator: Locator) {
  await page.keyboard.down('Shift');
  await inputLocator.press('Tab');
  await page.keyboard.up('Shift');
}

async function focusTag(page: Page, index: number) {
  const row = tagList(page).locator('.list-drag').nth(index);
  const input = row.locator('input.grow:not(.preview)');
  const preview = row.locator('input.preview');
  if (await preview.isVisible()) {
    // Clicking the preview is the normal user path that transfers focus to the editable input.
    await preview.click();
  } else {
    await input.click();
  }
  await expect(input).toBeFocused();
  return input;
}

function values(state: TagListState) {
  return state.rows.map(row => row.value);
}

test.describe.serial('Formly tag list keyboard navigation', () => {
  test('Enter inserts a tag after the current row without clearing it', async ({ page }) => {
    const initial = await loadTagList(page);
    const initialValues = values(initial);

    const input = await focusTag(page, 0);
    await input.press('Enter');
    await waitForTagCount(page, initialValues.length + 1);

    const expected = [initialValues[0], '', ...initialValues.slice(1)];
    await expect.poll(async () => values(await getTagListState(page))).toEqual(expected);

    await waitForInputFocus(page, 1);
    const state = await getTagListState(page);
    expect(state.rows[1].inputFocused).toBe(true);
    expect(state.activeValue).toBe('');
  });

  test('Tab moves to the current row remove button when the tag is not last', async ({ page }) => {
    const initial = await loadTagList(page);
    const initialValues = values(initial);

    const input = await focusTag(page, 0);
    await input.press('Tab');
    await waitForRemoveFocus(page, 0);

    const state = await getTagListState(page);
    expect(values(state)).toEqual(initialValues);
    expect(state.rows[0].removeFocused).toBe(true);
    expect(state.activeTagName).toBe('BUTTON');
    expect(state.activeValue).toBe('–');
  });

  test('Tab on the last tag adds a new row and focuses it', async ({ page }) => {
    const initial = await loadTagList(page);
    const initialValues = values(initial);

    const input = await focusTag(page, initialValues.length - 1);
    await input.press('Tab');
    await waitForTagCount(page, initialValues.length + 1);
    await waitForInputFocus(page, initialValues.length);

    const state = await getTagListState(page);
    expect(values(state)).toEqual([...initialValues, '']);
    expect(state.rows.at(-1)?.inputFocused).toBe(true);
    expect(state.activeValue).toBe('');
  });

  test('Shift+Tab on the first tag inserts a row above it', async ({ page }) => {
    const initial = await loadTagList(page);
    const initialValues = values(initial);

    const input = await focusTag(page, 0);
    await pressShiftTab(page, input);
    await waitForTagCount(page, initialValues.length + 1);
    await waitForInputFocus(page, 0);

    const state = await getTagListState(page);
    expect(values(state)).toEqual(['', ...initialValues]);
    expect(state.rows[0].inputFocused).toBe(true);
    expect(state.activeValue).toBe('');
  });

  test('Shift+Enter on the first tag inserts a row above it', async ({ page }) => {
    const initial = await loadTagList(page);
    const initialValues = values(initial);

    const input = await focusTag(page, 0);
    await input.press('Shift+Enter');
    await waitForTagCount(page, initialValues.length + 1);
    await waitForInputFocus(page, 0);

    const state = await getTagListState(page);
    expect(values(state)).toEqual(['', ...initialValues]);
    expect(state.rows[0].inputFocused).toBe(true);
    expect(state.activeValue).toBe('');
  });

  test('Shift+Enter on a later tag inserts a row above the current row', async ({ page }) => {
    const initial = await loadTagList(page);
    const initialValues = values(initial);

    const input = await focusTag(page, 1);
    await input.press('Shift+Enter');
    await waitForTagCount(page, initialValues.length + 1);
    await waitForInputFocus(page, 1);

    const state = await getTagListState(page);
    expect(values(state)).toEqual([initialValues[0], '', ...initialValues.slice(1)]);
    expect(state.rows[1].inputFocused).toBe(true);
    expect(state.activeValue).toBe('');
  });
});

test.describe.serial('Formly list keyboard navigation in edit forms', () => {
  test('clear data', async ({ page }) => {
    await clearAll(page);
  });

  test('enable kanban mods', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-kanban');
  });

  test('Enter inserts a row in the edit form without blanking later items', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/tags/kanban?debug=MOD', { waitUntil: 'networkidle' });
    await openSidebar(page);
    await page.getByText('Extend').click();
    await page.locator('[name=tag]').fill('list/edit');
    await page.locator('button', { hasText: 'Extend' }).click();

    const columns = page.locator('.columns');
    await columns.waitFor({ timeout: 15_000 });
    await columns.locator('button').first().click();

    const firstColumn = columns.locator('input').last();
    await firstColumn.waitFor({ state: 'attached' });
    await firstColumn.fill('doing');
    await firstColumn.press('Enter');

    await expect.poll(async () => await columns.locator('input').count()).toBe(2);
    await expect(columns.locator('input').nth(0)).toHaveValue('doing');
    await expect(columns.locator('input').nth(1)).toHaveValue('');
    await expect(page.locator('.error', { hasText: 'Cannot read properties of undefined' })).toHaveCount(0);
    expect(pageErrors.join('\n')).not.toContain("Cannot read properties of undefined (reading '_fields')");
  });
});

test.describe.serial('Formly list keyboard navigation in ref edit forms', () => {
  test('Enter in ref tags inserts a row without blanking the next tag', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/submit/text?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.getByRole('textbox', { name: 'Title:' }).fill('Tag enter repro');
    await page.getByRole('textbox', { name: 'Comment:' }).fill('Testing enter in edited ref tags');
    await page.getByRole('button', { name: '+ Add another tag' }).click();
    const submitTags = tagList(page).locator('input.grow:not(.preview)');
    await submitTags.nth(1).fill('public');
    await page.getByRole('button', { name: 'Submit' }).click();

    await page.getByText('edit', { exact: true }).click();

    const firstInput = await focusTag(page, 0);
    await expect.poll(async () => values(await getTagListState(page))).toEqual(['+user/debug', 'public']);
    await firstInput.press('Enter');

    await waitForTagCount(page, 3);
    await waitForInputFocus(page, 1);
    await expect.poll(async () => values(await getTagListState(page))).toEqual(['+user/debug', '', 'public']);
    expect(pageErrors.join('\n')).not.toContain("Cannot read properties of undefined (reading '_fields')");
  });
});
