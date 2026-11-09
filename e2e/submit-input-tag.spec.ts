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
    const board = page.locator('.input-tag input');
    await board.focus();
    await expect(await options(board)).toHaveCount(2);
    await expect((await options(board)).nth(1)).toHaveAttribute('value', 'jasper/bugs');
    await board.fill('jasper/bugs');
    await expect(page.locator('.tag-field input.preview[title="kanban/jasper/bugs"]')).toBeAttached();
  });

  test('shows an input per placeholder above the title', async ({ page }) => {
    await page.goto('/submit/text?debug=USER&inputTag=car/<Year>/<Make>&inputTag=color/<Color>', { waitUntil: 'networkidle' });
    const rows = page.locator('.input-tag');
    await expect(rows).toHaveCount(2);
    await expect(rows.first().locator('.tag-preview')).toHaveAttribute('title', 'car');
    await expect(rows.first().locator('input')).toHaveCount(2);
    await expect(rows.nth(1).locator('input')).toHaveAttribute('placeholder', 'Color');
    const inputTop = (await rows.first().boundingBox())!.y;
    const titleTop = (await page.locator('#title').boundingBox())!.y;
    expect(inputTop).toBeLessThan(titleTop);
  });

  test('suggests all possibilities out of order and pares them down in order', async ({ page }) => {
    await page.goto('/submit/text?debug=USER&inputTag=car/<Year>/<Make>', { waitUntil: 'networkidle' });
    const [year, make] = [page.locator('.input-tag input').first(), page.locator('.input-tag input').nth(1)];
    await make.focus();
    await expect(await options(make)).toHaveCount(3);
    await expect((await options(make)).first()).toHaveText('HONDA');

    await year.focus();
    await expect(await options(year)).toHaveCount(2);
    await year.fill('2020');
    await make.focus();
    await expect(await options(make)).toHaveCount(2);
    await expect((await options(make)).first()).toHaveAttribute('value', 'honda');
  });

  test('only offers prefixes the user can add', async ({ page }) => {
    await page.goto('/submit/text?debug=USER&inputTag=' + encodeURIComponent('+plugin,_plugin/secret/<Secret>'), { waitUntil: 'networkidle' });
    await expect(page.locator('.input-tag')).toHaveCount(1);
    await expect(page.locator('.input-tag select')).toHaveCount(0);
    await page.goto('/submit/text?debug=USER&inputTag=' + encodeURIComponent('_private,science/<Topic>'), { waitUntil: 'networkidle' });
    await expect(page.locator('.input-tag select')).toHaveCount(0);
    await expect(page.locator('.input-tag .tag-preview')).toHaveAttribute('title', 'science');
  });

  test('adds the filled out tags and submits', async ({ page }) => {
    await page.goto('/submit/text?debug=USER&inputTag=car/<Year>/<Make>&inputTag=color/<Color>', { waitUntil: 'networkidle' });
    await page.locator('#title').fill('Car');
    const inputs = page.locator('.input-tag input');
    await inputs.nth(1).fill('toyota');
    await inputs.nth(2).fill('red');
    await expect(page.locator('.tag-field input.preview[title="color/red"]')).toBeAttached();
    await expect(page.locator('.tag-field input.preview[title^="car/"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page).toHaveURL(/\/submit\/text/);

    await inputs.nth(0).fill('2020');
    await expect(page.locator('.tag-field input.preview[title="car/2020/toyota"]')).toBeAttached();
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page).toHaveURL(/\/ref\//);
    await expect(page.locator('.full-page.ref .tag', { hasText: 'TOYOTA' })).toBeVisible();
  });

  test('shows one dropdown with every permutation of the prefix', async ({ page }) => {
    await page.goto('/submit/text?debug=ADMIN&inputTag=' + encodeURIComponent('+plugin,_plugin/secret,other/<Secret>'), { waitUntil: 'networkidle' });
    const select = page.locator('.input-tag select');
    await expect(select).toHaveCount(1);
    await expect(select.locator('option')).toHaveCount(4);
    expect(await select.locator('option').evaluateAll(os => os.map(o => (o as HTMLOptionElement).value)))
      .toEqual(['+plugin/secret', '+plugin/other', '_plugin/secret', '_plugin/other']);
    await expect(select).toHaveValue('+plugin/secret');
    await page.locator('.input-tag input').fill('openai');
    await expect(page.locator('.tag-field input.preview[title="+plugin/secret/openai"]')).toBeAttached();
    await select.selectOption('_plugin/secret');
    await expect(page.locator('.tag-field input.preview[title="_plugin/secret/openai"]')).toBeAttached();
    await expect(page.locator('.tag-field input.preview[title="+plugin/secret/openai"]')).toHaveCount(0);
  });
});
