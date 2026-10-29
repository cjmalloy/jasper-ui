import { type APIRequestContext, expect, type Locator, type Page } from '@playwright/test';
import { validate } from 'jtd';
import { adminHeaders, test } from './setup';

test.describe('Plugin Form Builder', () => {
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  const runId = Date.now().toString(36);

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  async function createPlugin(request: APIRequestContext, origin: string, name: string, data: any) {
    const tag = `plugin/fb${name}${runId}`;
    const res = await request.post(`${api}/plugin`, {
      headers: await headers(request),
      data: { tag, origin, name, ...data },
    });
    expect(res.ok()).toBeTruthy();
    return tag;
  }

  async function getPlugin(request: APIRequestContext, origin: string, tag: string) {
    const res = await request.get(`${api}/plugin`, { headers: await headers(request), params: { tag: tag + origin } });
    expect(res.ok()).toBeTruthy();
    return res.json();
  }

  async function openBuilder(page: Page, tag: string) {
    await page.goto(`/settings/plugin?debug=ADMIN&search=${tag}`, { waitUntil: 'networkidle' });
    const item = page.locator('.plugin.list-item');
    await expect(item).toHaveCount(1);
    await item.locator('.actions .fake-link', { hasText: 'edit' }).click();
    const builder = item.locator('details.form-builder');
    await builder.locator('summary').click();
    await expect(builder.locator('.builder-form')).toBeVisible();
    return { item, builder };
  }

  async function save(page: Page, item: Locator) {
    const savePromise = page.waitForResponse(resp => (
      resp.url().includes('/api/v1/plugin') && resp.request().method() === 'PUT' && resp.ok()
    ));
    await item.locator('button[type=submit]').click();
    await savePromise;
  }

  function removeButton(row: Locator) {
    return row.locator('xpath=./button');
  }

  test('generate buttons can clear the schema and defaults after the last field is removed', async ({ page, request, origin }) => {
    const tag = await createPlugin(request, origin, 'clear', {
      config: { form: [{ key: 'title', type: 'string' }] },
      schema: { optionalProperties: { title: { type: 'string' } } },
      defaults: { title: 'stale' },
    });
    const { item, builder } = await openBuilder(page, tag);
    const rows = builder.locator('.builder-form .list-drag').filter({ has: page.locator('.formly-key') });
    await expect(rows).toHaveCount(1);
    await removeButton(rows.first()).click();
    await expect(rows).toHaveCount(0);

    await expect(builder.locator('button.generate-schema')).toBeEnabled({ timeout: 1000 });
    await builder.locator('button.generate-schema').click();
    await expect(builder.locator('button.generate-defaults')).toBeEnabled({ timeout: 1000 });
    await builder.locator('button.generate-defaults').click();
    await save(page, item);

    const saved = await getPlugin(request, origin, tag);
    expect(saved.schema).toEqual({ optionalProperties: {} });
    expect(saved.defaults ?? {}).toEqual({});
  });

  test('clearing an optional number default stays valid against the generated schema', async ({ page, request, origin }) => {
    const tag = await createPlugin(request, origin, 'number', {
      config: { form: [{ key: 'width', type: 'integer', props: { label: 'Width:' } }] },
      defaults: { width: 5 },
    });
    const { item, builder } = await openBuilder(page, tag);
    await builder.locator('button.generate-schema').click();
    const input = builder.locator('.defaults-form input[type=number]');
    await expect(input).toHaveValue('5');
    await input.fill('');
    await input.blur();
    await save(page, item);

    const saved = await getPlugin(request, origin, tag);
    expect(validate(saved.schema, saved.defaults ?? {})).toEqual([]);
  });

  test('generate defaults prunes removed nested keys', async ({ page, request, origin }) => {
    const tag = await createPlugin(request, origin, 'nested', {
      config: {
        form: [{
          key: 'profile',
          fieldGroup: [
            { key: 'name', type: 'string' },
            { key: 'retired', type: 'boolean' },
          ],
        }],
      },
      defaults: { profile: { name: 'Alice', retired: true } },
    });
    const { item, builder } = await openBuilder(page, tag);
    const nested = builder.locator('.formly-field-group .list-drag').filter({ has: page.locator('.formly-key') });
    await expect(nested).toHaveCount(2);
    await removeButton(nested.nth(1)).click();
    await expect(nested).toHaveCount(1);
    await builder.locator('button.generate-schema').click();
    await builder.locator('button.generate-defaults').click();
    await save(page, item);

    const saved = await getPlugin(request, origin, tag);
    expect(saved.defaults).toEqual({ profile: { name: 'Alice' } });
    expect(validate(saved.schema, saved.defaults)).toEqual([]);
  });

  test('generate defaults works with formState expressions', async ({ page, request, origin }) => {
    const tag = await createPlugin(request, origin, 'formstate', {
      config: {
        form: [{
          key: 'subscriptions',
          type: 'string',
          defaultValue: 'home',
          expressions: { hide: '!formState.admin.hasHome' },
        }],
      },
    });
    const { item, builder } = await openBuilder(page, tag);
    await builder.locator('button.generate-schema').click();
    await builder.locator('button.generate-defaults').click();
    await save(page, item);

    const saved = await getPlugin(request, origin, tag);
    expect(saved.schema).toEqual({ optionalProperties: { subscriptions: { type: 'string' } } });
    expect(saved.defaults ?? {}).toEqual({});
  });

  test('a list built in the UI can add items', async ({ page, request, origin }) => {
    const tag = await createPlugin(request, origin, 'list', { config: {} });
    const { item, builder } = await openBuilder(page, tag);
    const form = builder.locator('.builder-admin-form');
    await form.locator('button', { hasText: '+ Add another field' }).click();
    const field = form.locator('.formly-field-config');
    await expect(field).toHaveCount(1);
    await field.locator('.formly-key input').fill('items');
    await field.locator('.formly-type select').selectOption('list');
    await save(page, item);

    await page.reload({ waitUntil: 'networkidle' });
    const reloaded = page.locator('.plugin.list-item');
    await reloaded.locator('.actions .fake-link', { hasText: 'edit' }).click();
    const admin = reloaded.locator('.admin-form');
    await admin.locator('button').first().click();
    await expect(admin.locator('.list-drag')).toHaveCount(1);
  });

  test('clearing an optional color default stays valid against the generated schema', async ({ page, request, origin }) => {
    const tag = await createPlugin(request, origin, 'color', {
      config: { form: [{ key: 'accent', type: 'color' }] },
      defaults: { accent: '#ff0000' },
    });
    const { item, builder } = await openBuilder(page, tag);
    await builder.locator('button.generate-schema').click();
    await builder.locator('.defaults-form button[title=Clear]').click();
    await save(page, item);

    const saved = await getPlugin(request, origin, tag);
    expect(validate(saved.schema, saved.defaults ?? {})).toEqual([]);
  });

  test('a keyed group in both form and advancedForm is merged in the schema', async ({ page, request, origin }) => {
    const tag = await createPlugin(request, origin, 'merge', {
      config: {
        form: [{ key: 'settings', fieldGroup: [{ key: 'a', type: 'string' }] }],
        advancedForm: [{ key: 'settings', fieldGroup: [{ key: 'b', type: 'string' }] }],
      },
    });
    const { item, builder } = await openBuilder(page, tag);
    await builder.locator('button.generate-schema').click();
    await save(page, item);

    const saved = await getPlugin(request, origin, tag);
    expect(saved.schema).toEqual({
      optionalProperties: {
        settings: {
          optionalProperties: {
            a: { type: 'string' },
            b: { type: 'string' },
          },
        },
      },
    });
  });

  test('generate defaults initializes list item defaults', async ({ page, request, origin }) => {
    const tag = await createPlugin(request, origin, 'listdefaults', {
      config: {
        form: [{
          key: 'rows',
          type: 'list',
          defaultValue: [{}],
          fieldArray: { fieldGroup: [{ key: 'name', type: 'string', defaultValue: 'x' }] },
        }],
      },
    });
    const { item, builder } = await openBuilder(page, tag);
    await builder.locator('button.generate-defaults').click();
    await save(page, item);

    const saved = await getPlugin(request, origin, tag);
    expect(saved.defaults).toEqual({ rows: [{ name: 'x' }] });
  });

  test('changing a select type and back keeps its options', async ({ page, request, origin }) => {
    const tag = await createPlugin(request, origin, 'options', {
      config: {
        form: [{ key: 'color', type: 'select', props: { options: [{ value: 'red', label: 'Red' }] } }],
      },
    });
    const { item, builder } = await openBuilder(page, tag);
    const field = builder.locator('.builder-form .formly-field-config');
    await field.locator('.formly-type select').selectOption('string');
    await expect(field.locator('.formly-options')).toHaveCount(0);
    await field.locator('.formly-type select').selectOption('select');
    await save(page, item);

    const saved = await getPlugin(request, origin, tag);
    expect(saved.config.form[0].props.options).toEqual([{ value: 'red', label: 'Red' }]);
  });

  test('opening the builder keeps required on a group', async ({ page, request, origin }) => {
    const tag = await createPlugin(request, origin, 'required', {
      config: {
        title: 'before',
        form: [{ key: 'group', props: { required: true }, fieldGroup: [{ key: 'a', type: 'string' }] }],
      },
    });
    const { item } = await openBuilder(page, tag);
    await save(page, item);

    const saved = await getPlugin(request, origin, tag);
    expect(saved.config.form[0].props?.required).toBe(true);
  });
});
