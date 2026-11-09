import { type APIRequestContext, expect } from '@playwright/test';
import { adminHeaders, localOrigin, mod, test } from './setup';

test.describe.serial('Submit inputTag', () => {
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  async function options(input: import('@playwright/test').Locator) {
    const list = await input.getAttribute('list');
    return input.page().locator(`datalist[id="${list}"] option`);
  }

  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-root');
  });

  test('create exts', async ({ request }) => {
    for (const tag of ['car/2020/toyota', 'car/2020/honda', 'car/2021/ford']) {
      const res = await request.post(`${api}/ext`, {
        headers: await headers(request),
        data: { tag, origin: localOrigin(), name: tag.split('/')[2].toUpperCase() },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
  });

  test('suggests more than one level for the last input', async ({ page, request }) => {
    for (const tag of ['kanban/jasper', 'kanban/jasper/bugs']) {
      const res = await request.post(`${api}/ext`, {
        headers: await headers(request),
        data: { tag, origin: localOrigin() },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
    await page.goto('/submit/text?debug=USER&inputTag=kanban/<Board>', { waitUntil: 'networkidle' });
    const board = page.locator('.stencil input.tag-input');
    await board.focus();
    await expect(await options(board)).toHaveCount(2);
    await expect((await options(board)).nth(1)).toHaveAttribute('value', 'jasper/bugs');
    await board.fill('jasper/bugs');
    await board.blur();
    await expect(page.locator('.tag-field input.preview[title="kanban/jasper/bugs"]')).toBeAttached();
  });

  test('suggests the whole tag for every input', async ({ page }) => {
    await page.goto('/submit/text?debug=USER&inputTag=kanban/<Board1>/<Board2>', { waitUntil: 'networkidle' });
    const [board1, board2] = [0, 1].map(i => page.locator('.stencil input.tag-input').nth(i));
    await board1.focus();
    await expect(page.locator(`datalist[id="${await board1.getAttribute('list')}"] option[value="jasper/bugs"]`)).toHaveCount(1);
    // Pick from the datalist
    await board1.evaluate((input: HTMLInputElement) => {
      input.value = 'jasper/bugs';
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
    });
    await expect(board1).toBeFocused();
    await expect(board1).toHaveValue('jasper');
    await expect(board2).toHaveValue('bugs');
    // Typing after a slash stays in this input until leaving it
    await board1.press('End');
    await board1.pressSequentially('/todo');
    await expect(board1).toBeFocused();
    await expect(board1).toHaveValue('jasper/todo');
    await expect(board2).toHaveValue('bugs');
    await page.locator('#title').focus();
    await expect(board1).toHaveValue('jasper');
    await expect(board2).toHaveValue('todo');
    await expect(page.locator('.tag-field input.preview[title="kanban/jasper/todo"]')).toBeAttached();
    await board1.fill('');
    await board2.fill('');
    await board2.focus();
    await expect(page.locator(`datalist[id="${await board2.getAttribute('list')}"] option[value="bugs"]`)).toHaveCount(1);
    // Pick from the datalist
    await board2.evaluate((input: HTMLInputElement) => {
      input.value = 'bugs';
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
    });
    await expect(board1).toHaveValue('jasper');
    await expect(page.locator('.tag-field input.preview[title="kanban/jasper/bugs"]')).toBeAttached();
  });

  test('shows an input per placeholder above the title', async ({ page }) => {
    await page.goto('/submit/text?debug=USER&inputTag=car/<Year>/<Make>&inputTag=color/<Color>', { waitUntil: 'networkidle' });
    const rows = page.locator('.stencil');
    await expect(rows).toHaveCount(2);
    await expect(rows.first().locator('.tag-preview')).toHaveAttribute('title', 'car');
    await expect(rows.first().locator('input.tag-input')).toHaveCount(2);
    await expect(rows.nth(1).locator('input.tag-input')).toHaveAttribute('placeholder', 'Color');
    const inputTop = (await rows.first().boundingBox())!.y;
    const titleTop = (await page.locator('#title').boundingBox())!.y;
    expect(inputTop).toBeLessThan(titleTop);
  });

  test('suggests all possibilities out of order and pares them down in order', async ({ page }) => {
    await page.goto('/submit/text?debug=USER&inputTag=car/<Year>/<Make>', { waitUntil: 'networkidle' });
    const [year, make] = [page.locator('.stencil input.tag-input').first(), page.locator('.stencil input.tag-input').nth(1)];
    await make.focus();
    await expect(await options(make)).toHaveCount(3);
    await expect((await options(make)).first()).toHaveText('HONDA');

    await year.focus();
    await expect(await options(year)).toHaveCount(3);
    expect(await (await options(year)).evaluateAll(os => os.map(o => (o as HTMLOptionElement).value).sort()))
      .toEqual(['2020/honda', '2020/toyota', '2021/ford']);
    await year.fill('2020');
    await make.focus();
    await expect(await options(make)).toHaveCount(2);
    await expect((await options(make)).first()).toHaveAttribute('value', 'honda');
  });

  test('only offers prefixes the user can add', async ({ page }) => {
    await page.goto('/submit/text?debug=USER&inputTag=' + encodeURIComponent('+plugin,_plugin/secret/<Secret>'), { waitUntil: 'networkidle' });
    await expect(page.locator('.stencil')).toHaveCount(1);
    await expect(page.locator('.stencil select')).toHaveCount(0);
    await page.goto('/submit/text?debug=USER&inputTag=' + encodeURIComponent('_private,science/<Topic>'), { waitUntil: 'networkidle' });
    await expect(page.locator('.stencil select')).toHaveCount(0);
    await expect(page.locator('.stencil .tag-preview')).toHaveAttribute('title', 'science');
  });

  test('adds the filled out tags and submits', async ({ page }) => {
    await page.goto('/submit/text?debug=USER&inputTag=car/<Year>/<Make>&inputTag=color/<Color>', { waitUntil: 'networkidle' });
    await page.locator('#title').fill('Car');
    const inputs = page.locator('.stencil input.tag-input');
    await inputs.nth(1).fill('toyota');
    await inputs.nth(2).fill('red');
    await inputs.nth(2).blur();
    await expect(page.locator('.tag-field input.preview[title="color/red"]')).toBeAttached();
    await expect(page.locator('.tag-field input.preview[title^="car/"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page).toHaveURL(/\/submit\/text/);

    await inputs.nth(0).fill('2020');
    await inputs.nth(0).blur();
    await expect(page.locator('.tag-field input.preview[title="car/2020/toyota"]')).toBeAttached();
    const preview = page.locator('.stencil input.preview[title="car/2020/toyota"]');
    await expect(preview).toHaveValue('TOYOTA');
    await expect(inputs.nth(1)).toHaveClass(/hidden-without-removing/);
    await preview.click();
    await expect(inputs.nth(1)).toBeFocused();
    await expect(preview).toBeHidden();
    await expect(inputs.nth(1)).toHaveValue('toyota');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page).toHaveURL(/\/ref\//);
    await expect(page.locator('.full-page.ref .tag', { hasText: 'TOYOTA' })).toBeVisible();
  });

  test('typing a slash fills the following inputs when leaving the input', async ({ page }) => {
    await page.goto('/submit/text?debug=USER&inputTag=car/<Year>/<Make>/<Model>', { waitUntil: 'networkidle' });
    const inputs = page.locator('.stencil input.tag-input');
    await inputs.nth(0).pressSequentially('2021/ford/focus');
    await expect(inputs.nth(0)).toBeFocused();
    await expect(inputs.nth(1)).toHaveValue('');
    await expect(inputs.nth(2)).toHaveValue('');
    await page.locator('#title').focus();
    await expect(inputs.nth(0)).toHaveValue('2021');
    await expect(inputs.nth(1)).toHaveValue('ford');
    await expect(inputs.nth(2)).toHaveValue('focus');
    await expect(page.locator('.tag-field input.preview[title="car/2021/ford/focus"]')).toBeAttached();
    await inputs.nth(0).fill('2020/toyota/corolla/le');
    await page.locator('#title').focus();
    await expect(page.locator('.tag-field input.preview[title="car/2020/toyota/corolla/le"]')).toBeAttached();
  });

  test('pressing enter fills the following inputs without submitting', async ({ page }) => {
    await page.goto('/submit/text?debug=USER&inputTag=car/<Year>/<Make>', { waitUntil: 'networkidle' });
    await page.locator('#title').fill('Car');
    const inputs = page.locator('.stencil input.tag-input');
    await inputs.nth(0).fill('2021/ford');
    await inputs.nth(0).press('Enter');
    await expect(inputs.nth(0)).toBeFocused();
    await expect(inputs.nth(0)).toHaveValue('2021');
    await expect(inputs.nth(1)).toHaveValue('ford');
    await expect(page).toHaveURL(/\/submit\/text/);
    await expect(page.locator('.full-page.ref')).toHaveCount(0);
  });

  test('reports invalid input on submit', async ({ page }) => {
    await page.goto('/submit/text?debug=USER&inputTag=car/<Year>/<Make>', { waitUntil: 'networkidle' });
    await page.locator('#title').fill('Car');
    const inputs = page.locator('.stencil input.tag-input');
    await inputs.nth(0).fill('Twenty');
    await inputs.nth(1).fill('ford');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(inputs.nth(0)).toBeFocused();
    expect(await inputs.nth(0).evaluate((i: HTMLInputElement) => i.validationMessage)).toBe('Must be lower case letters, numbers and periods.');
    await expect(page).toHaveURL(/\/submit\/text/);
  });

  test('shows one dropdown with every permutation of the prefix', async ({ page }) => {
    await page.goto('/submit/text?debug=ADMIN&inputTag=' + encodeURIComponent('+plugin,_plugin/secret,other/<Secret>'), { waitUntil: 'networkidle' });
    const select = page.locator('.stencil select');
    await expect(select).toHaveCount(1);
    await expect(select.locator('option')).toHaveCount(4);
    expect(await select.locator('option').evaluateAll(os => os.map(o => (o as HTMLOptionElement).value)))
      .toEqual(['+plugin/secret', '+plugin/other', '_plugin/secret', '_plugin/other']);
    await expect(select).toHaveValue('+plugin/secret');
    await page.locator('.stencil input.tag-input').fill('openai');
    await page.locator('.stencil input.tag-input').blur();
    await expect(page.locator('.tag-field input.preview[title="+plugin/secret/openai"]')).toBeAttached();
    await select.selectOption('_plugin/secret');
    await expect(page.locator('.tag-field input.preview[title="_plugin/secret/openai"]')).toBeAttached();
    await expect(page.locator('.tag-field input.preview[title="+plugin/secret/openai"]')).toHaveCount(0);
  });

  test('fills out hierarchical tags top down and adds a tag for each level', async ({ page, request }) => {
    for (const [tag, name] of [['car', 'Car'], ['car/toyota', 'Toyota'], ['car/toyota/prius', 'Prius']]) {
      const res = await request.post(`${api}/ext`, {
        headers: await headers(request),
        data: { tag, origin: localOrigin(), name },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
    await page.goto('/submit/text?debug=USER&hierarchicalTag=car/<Make>&hierarchicalTag=car/<Make>/<Model>', { waitUntil: 'networkidle' });
    await expect(page.locator('.hierarchical-tag-label')).toHaveText(['Car Make:', 'Car Model:']);
    const [make, model] = [page.locator('.stencil input.tag-input').first(), page.locator('.stencil input.tag-input').nth(1)];
    await expect(model).toBeDisabled();
    await make.fill('toyota');
    await expect(model).toBeEnabled();
    await model.fill('prius');
    await page.locator('#title').fill('Prius');
    await expect(page.locator('.stencil input.preview[title="car/toyota"]')).toHaveValue('Toyota');
    await expect(page.locator('.tag-field input.preview[title="car/toyota"]')).toBeAttached();
    await expect(page.locator('.tag-field input.preview[title="car/toyota/prius"]')).toBeAttached();

    await page.locator('.stencil input.preview[title="car/toyota"]').click();
    await make.fill('toyot');
    await make.blur();
    await expect(model).toHaveValue('');
    await expect(page.locator('.tag-field input.preview[title="car/toyota/prius"]')).toHaveCount(0);
    await make.fill('toyota');
    await model.fill('prius');

    const created = page.waitForRequest(req => req.url().includes('/api/v1/ref') && req.method() === 'POST');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    const ref = (await created).postDataJSON();
    expect(ref.tags).toContain('car/toyota');
    expect(ref.tags).toContain('car/toyota/prius');
    await expect(page.locator('.full-page.ref .tag', { hasText: 'Toyota' })).toBeVisible();
    await expect(page.locator('.full-page.ref .tag', { hasText: 'Prius' })).toBeVisible();
  });

  test('typing a slash fills the following hierarchical levels when leaving the input', async ({ page }) => {
    await page.goto('/submit/text?debug=USER&hierarchicalTag=car/<Make>/<Model>/<Trim>', { waitUntil: 'networkidle' });
    const [make, model, trim] = [0, 1, 2].map(i => page.locator('.stencil input.tag-input').nth(i));
    await make.pressSequentially('toyota/corolla/le');
    await expect(make).toBeFocused();
    await expect(trim).toHaveValue('');
    await page.locator('#title').focus();
    await expect(make).toHaveValue('toyota');
    await expect(model).toHaveValue('corolla');
    await expect(trim).toHaveValue('le');
    await expect(page.locator('.tag-field input.preview[title="car/toyota/corolla/le"]')).toBeAttached();
  });

  test('fills out hierarchical tags without a prefix', async ({ page }) => {
    await page.goto('/submit/text?debug=USER&hierarchicalTag=<Make>&hierarchicalTag=<Make>/<Model>', { waitUntil: 'networkidle' });
    await expect(page.locator('.hierarchical-tag-label')).toHaveText(['Make:', 'Model:']);
    const [make, model] = [page.locator('.stencil input.tag-input').first(), page.locator('.stencil input.tag-input').nth(1)];
    await expect(model).toBeDisabled();
    await make.fill('toyota');
    await model.fill('prius');
    await model.blur();
    await expect(page.locator('.tag-field input.preview[title="toyota"]')).toBeAttached();
    await expect(page.locator('.tag-field input.preview[title="toyota/prius"]')).toBeAttached();
  });

  test('shows one input per hierarchical level and only adds the given tags', async ({ page }) => {
    await page.goto('/submit/text?debug=USER&hierarchicalTag=car/<Make>/<Model>&hierarchicalTag=car/<Make>/<Model>/<Trim>', { waitUntil: 'networkidle' });
    await expect(page.locator('.hierarchical-tag-label')).toHaveText(['Car Make:', 'Car Model:', 'Car Trim:']);
    await expect(page.locator('.stencil input.tag-input')).toHaveCount(3);
    const [make, model, trim] = [0, 1, 2].map(i => page.locator('.stencil input.tag-input').nth(i));
    await make.fill('toyota');
    await model.fill('prius');
    await trim.fill('le');
    await page.locator('#title').fill('Prius LE');
    const created = page.waitForRequest(req => req.url().includes('/api/v1/ref') && req.method() === 'POST');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    const ref = (await created).postDataJSON();
    expect(ref.tags).not.toContain('car/toyota');
    expect(ref.tags).toContain('car/toyota/prius');
    expect(ref.tags).toContain('car/toyota/prius/le');
  });
});
