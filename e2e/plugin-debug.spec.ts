import { type APIRequestContext, expect, type Page } from '@playwright/test';
import { adminHeaders, localOrigin, mod, openSidebar, test } from './setup';

test.describe.serial('Debug Plugin', () => {
  const tag = 'debugselect' + Date.now();
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-experiments', '#mod-debug');
  });

  test('is up to date right after installing', async ({ page }) => {
    const row = page.locator('.mod-row', { has: page.locator('#mod-debug') });
    await page.goto('/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(row.locator('#mod-debug')).toBeChecked();
    await expect(row.locator('.mod-update-link')).toHaveCount(0);
  });

  test('create refs with debug values', async ({ request }) => {
    const refs: [string, string[], any][] = [
      ['One', [], { select: '1', radio: 'red', show: true, multicheckbox: { a: true }, input: 'debug', number: 42 }],
      ['Two', [], { select: '2', radio: 'blue', show: false, multicheckbox: { a: false }, input: 'other', number: 7 }],
      ['Another Two', ['debug/a'], { select: '2', radio: 'green', number: 150 }],
      ['Three', ['debug/b'], { select: '3', radio: 'red', show: true, input: 'debug', number: -5 }],
    ];
    for (const [title, tags, debug] of refs) {
      const res = await request.post(`${api}/ref`, {
        headers: await headers(request),
        data: {
          url: `comment:${tag}/${title}`,
          title,
          tags: ['public', tag, 'plugin/debug', ...tags],
          plugins: { 'plugin/debug': debug },
          origin: localOrigin(),
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
  });

  test('filters equal to a select option', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=USER&sort=title`, { waitUntil: 'networkidle' });
    const links = page.locator('.ref-list-item .link a');
    await expect(links).toHaveText(['Another Two', 'One', 'Three', 'Two']);
    await openSidebar(page);
    await page.locator('.filter select.big').selectOption({ label: '🐞️ select' });
    const option = page.locator('.filter .filter-option');
    await expect(option).toHaveValue('1');
    await expect(links).toHaveText(['One']);

    const request = page.waitForRequest(req => req.url().includes('/api/v1/ref/page') && req.url().includes('filter='));
    await option.selectOption({ label: 'Option 2' });
    expect(new URL((await request).url()).searchParams.getAll('filter')).toEqual(['plugins->plugin/debug->select/equals/2']);
    await expect(links).toHaveText(['Another Two', 'Two']);
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual(['plugins->plugin/debug->select/equals/2']);
  });

  test('reads the option from the URL', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=USER&sort=title&filter=plugins->plugin/debug->select/equals/3`, { waitUntil: 'networkidle' });
    await expect(page.locator('.ref-list-item .link a')).toHaveText(['Three']);
    await openSidebar(page);
    await expect(page.locator('.filter #filter-0 option:checked')).toHaveText('🐞️ select');
    await expect(page.locator('.filter .filter-option')).toHaveValue('3');
  });

  async function pick(page: Page, label: string, filter = '') {
    await page.goto(`/tag/${tag}?debug=USER&sort=title${filter}`, { waitUntil: 'networkidle' });
    await openSidebar(page);
    await page.locator('.filter select.big').selectOption({ label });
    return page.locator('.ref-list-item .link a');
  }

  function filterParams(page: Page, op: 'before' | 'after' | 'equals') {
    const params = (url: string) => new URL(url).searchParams.getAll('filter').filter(f => f.includes(`/${op}/`));
    return page.waitForRequest(req => req.url().includes('/api/v1/ref/page') && params(req.url()).length > 0)
      .then(req => params(req.url()));
  }

  test('radio options come from the plugin form', async ({ page }) => {
    const links = await pick(page, '🐞️ radio');
    const option = page.locator('.filter .filter-option');
    await expect(option.locator('option')).toHaveText(['Red', 'Blue', 'Green']);
    await expect(option).toHaveValue('red');
    await expect(links).toHaveText(['One', 'Three']);

    const params = filterParams(page, 'equals');
    await option.selectOption({ label: 'Green' });
    expect(await params).toEqual(['plugins->plugin/debug->radio/equals/green']);
    await expect(links).toHaveText(['Another Two']);
  });

  test('boolean fields offer true and false', async ({ page }) => {
    const links = await pick(page, '🐞️ show');
    const option = page.locator('.filter .filter-option');
    await expect(option.locator('option')).toHaveText(['true', 'false']);
    await expect(links).toHaveText(['One', 'Three']);

    await option.selectOption('false');
    await expect(links).toHaveText(['Two']);
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual(['plugins->plugin/debug->show/equals/false']);
  });

  test('nested fields use the configured options', async ({ page }) => {
    const links = await pick(page, '🐞️ option A');
    const option = page.locator('.filter .filter-option');
    await expect(option.locator('option')).toHaveText(['✅️ checked', '⬜️ unchecked']);
    await expect(links).toHaveText(['One']);

    const params = filterParams(page, 'equals');
    await option.selectOption({ label: '⬜️ unchecked' });
    expect(await params).toEqual(['plugins->plugin/debug->multicheckbox->a/equals/false']);
    await expect(links).toHaveText(['Two']);
  });

  test('text fields filter on the typed value', async ({ page }) => {
    const links = await pick(page, '🐞️ string');
    const value = page.locator('.filter .filter-value');
    await expect(value).toHaveValue('debug');
    await expect(links).toHaveText(['One', 'Three']);

    await value.fill('other');
    await value.press('Enter');
    await expect(links).toHaveText(['Two']);
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual(['plugins->plugin/debug->input/equals/other']);
  });

  test('numeric fields filter on an equal number', async ({ page }) => {
    const params = filterParams(page, 'equals');
    const links = await pick(page, '🐞️ number');
    expect(await params).toEqual(['plugins->plugin/debug->number:num/equals/42']);
    await expect(page.locator('.filter .filter-value')).toHaveValue('42');
    await expect(links).toHaveText(['One']);
  });

  test('numeric sorts filter on both ends of a range', async ({ page }) => {
    let params = filterParams(page, 'after');
    const links = await pick(page, '🐞️ number over');
    expect(await params).toEqual(['plugins->plugin/debug->number:num/after/0']);
    await expect(links).toHaveText(['Another Two', 'One', 'Two']);

    params = filterParams(page, 'before');
    await page.locator('.filter select.big').selectOption({ label: '🐞️ number under' });
    expect(await params).toEqual(['plugins->plugin/debug->number:num/before/100']);
    await expect(page.locator('.filter #filter-1 option:checked')).toHaveText('🐞️ number under');
    await expect(links).toHaveText(['One', 'Two']);
  });

  test('numeric sorts filter below a value', async ({ page }) => {
    const params = filterParams(page, 'before');
    const links = await pick(page, '🐞️ number under');
    expect(await params).toEqual(['plugins->plugin/debug->number:num/before/100']);
    await expect(links).toHaveText(['One', 'Three', 'Two']);
  });

  test('switching between equals and a range keeps the value', async ({ page }) => {
    const links = await pick(page, '🐞️ number');
    await expect(links).toHaveText(['One']);
    await page.locator('.filter #filter-0').selectOption({ label: '🐞️ number over' });
    await expect(page.locator('.filter #filter-0 option:checked')).toHaveText('🐞️ number over');
    await expect(links).toHaveText(['Another Two']);
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual(['plugins->plugin/debug->number:num/after/42']);

    await page.locator('.filter #filter-0').selectOption({ label: '🐞️ number' });
    await expect(links).toHaveText(['One']);
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual(['plugins->plugin/debug->number:num/equals/42']);
  });

  test('tag fields filter on the sub-tag', async ({ page }) => {
    const params = filterParams(page, 'equals');
    const links = await pick(page, '🐞️ debug tag');
    expect(await params).toEqual(['tags->debug/equals/a']);
    await expect(links).toHaveText(['Another Two']);

    const value = page.locator('.filter .filter-value');
    await value.fill('b');
    await value.press('Enter');
    await expect(links).toHaveText(['Three']);
  });

  test('equals and range filters combine', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=USER&sort=title`
      + '&filter=plugins->plugin/debug->radio/equals/red'
      + '&filter=plugins->plugin/debug->number:num/after/0', { waitUntil: 'networkidle' });
    await expect(page.locator('.ref-list-item .link a')).toHaveText(['One']);
    await openSidebar(page);
    await expect(page.locator('.filter #filter-0 option:checked')).toHaveText('🐞️ radio');
    await expect(page.locator('.filter #filter-1 option:checked')).toHaveText('🐞️ number over');
    await expect(page.locator('.filter .filter-option')).toHaveValue('red');
    await expect(page.locator('.filter .filter-value')).toHaveValue('0');
  });
});
