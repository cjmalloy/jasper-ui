import { type APIRequestContext, expect, type Locator, type Page } from '@playwright/test';
import { validate } from 'jtd';
import { adminHeaders, mod, test } from './setup';

test.describe('Plugin Form Builder', () => {
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  const runId = Date.now().toString(36);

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  type Kind = 'plugin' | 'template';

  async function create(request: APIRequestContext, origin: string, type: Kind, name: string, data: any) {
    const tag = `${type === 'plugin' ? 'plugin/' : ''}fb${name}${runId}`;
    const res = await request.post(`${api}/${type}`, {
      headers: await headers(request),
      data: { tag, origin, name, ...data },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    return tag;
  }

  async function createPlugin(request: APIRequestContext, origin: string, name: string, data: any) {
    return create(request, origin, 'plugin', name, data);
  }

  async function get(request: APIRequestContext, origin: string, type: Kind, tag: string) {
    const res = await request.get(`${api}/${type}`, { headers: await headers(request), params: { tag: tag + origin } });
    expect(res.ok()).toBeTruthy();
    return res.json();
  }

  async function getPlugin(request: APIRequestContext, origin: string, tag: string) {
    return get(request, origin, 'plugin', tag);
  }

  function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async function openBuilder(page: Page, tag: string, type: Kind = 'plugin') {
    await page.goto(`/settings/${type}?debug=ADMIN&search=${encodeURIComponent(tag)}`, { waitUntil: 'networkidle' });
    // The link shows the name or tag, and the host shows the qualified tag, origin or root
    const exact = tag ? new RegExp(`^\\(?${escapeRegExp(tag)}(@[a-z0-9.]*)?\\)?$`) : /^\(root: .*\)$/;
    const item = page.locator(`.${type}.list-item`).filter({ has: page.locator('.link > *').getByText(exact) });
    await expect(item).toHaveCount(1);
    await item.locator('.actions .fake-link', { hasText: 'edit' }).click();
    const builder = item.locator('details.form-builder');
    await builder.locator('summary').click();
    await expect(builder.locator('.builder-form')).toBeVisible();
    return { item, builder };
  }

  async function save(page: Page, item: Locator, type: Kind = 'plugin') {
    const savePromise = page.waitForResponse(resp => (
      resp.url().includes(`/api/v1/${type}`) && resp.request().method() === 'PUT'
    ));
    await item.locator('button[type=submit]').click();
    const res = await savePromise;
    expect(res.ok(), await res.text()).toBeTruthy();
    await expect(item.locator('details.form-builder')).toHaveCount(0);
  }

  async function generate(builder: Locator) {
    await builder.locator('button.generate-schema').click();
    await builder.locator('button.generate-defaults').click();
  }

  /** Add a field to the end of a builder list and return its row. */
  async function addField(list: Locator, key: string, type?: string) {
    const group = list.locator('.form-group').first();
    const rows = group.locator(':scope > .list-drag');
    const before = await rows.count();
    await group.locator(':scope > button').click();
    await expect(rows).toHaveCount(before + 1);
    const row = rows.last().locator('.formly-field-config').first();
    await row.locator('.formly-key input').first().fill(key);
    if (type) await row.locator('.formly-type select').first().selectOption(type);
    return row;
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

  test('only lists with an item editor can be built in the UI', async ({ page, request, origin }) => {
    const tag = await createPlugin(request, origin, 'list', { config: {} });
    const { item, builder } = await openBuilder(page, tag);
    const form = builder.locator('.builder-admin-form');
    await form.locator('button', { hasText: '+ Add another field' }).click();
    const field = form.locator('.formly-field-config');
    await expect(field).toHaveCount(1);
    await field.locator('.formly-key input').fill('items');
    await expect(field.locator('.formly-type select').getByRole('option', { name: 'list', exact: true })).toHaveCount(0);
    await field.locator('.formly-type select').selectOption('tags');
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

  /** Text in the JSON editor for a field of the Plugin or Template form. */
  async function editorValue(item: Locator, field: 'config' | 'schema' | 'defaults') {
    const editor = item.locator(`.json-editor[id$="-${field}"]`);
    await expect(editor.locator('.monaco-editor')).toHaveCount(1);
    return editor.evaluate(el => {
      const editors: any[] = (window as any).monaco.editor.getEditors();
      return editors.find(e => el.contains(e.getContainerDomNode()))?.getValue() as string;
    });
  }

  for (const type of ['plugin', 'template'] as const) {
    test(`every builder type generates a schema the server accepts for a ${type}`, async ({ page, request, origin }) => {
      test.setTimeout(300_000);
      const tag = await create(request, origin, type, 'types', { config: {} });
      const { item, builder } = await openBuilder(page, tag, type);
      const form = builder.locator('.builder-form');
      const first = await addField(form, 'f_first');
      const types = (await first.locator('.formly-type select option').allTextContents())
        .map(t => t.trim())
        .filter(t => t && t !== 'Group');
      expect(types.length).toBeGreaterThan(10);
      await first.locator('.formly-key input').first().fill('f_' + types[0]);
      await first.locator('.formly-type select').first().selectOption(types[0]);
      for (const t of types.slice(1)) await addField(form, 'f_' + t, t);
      await generate(builder);
      await save(page, item, type);

      const saved = await get(request, origin, type, tag);
      expect(saved.config.form.map((f: any) => f.type)).toEqual(types);
      const keys = Object.keys({ ...saved.schema.properties, ...saved.schema.optionalProperties }).sort();
      expect(keys).toEqual(types.map(t => 'f_' + t).sort());
      expect(validate(saved.schema, saved.defaults ?? {})).toEqual([]);
    });

    test(`generators give the same result when clicked twice for a ${type}`, async ({ page, request, origin }) => {
      test.setTimeout(120_000);
      const tag = await create(request, origin, type, 'twice', {
        config: {
          form: [
            { key: 'title', type: 'string', defaultValue: 'hi' },
            { key: 'count', type: 'integer', props: { required: true } },
            { key: 'color', type: 'select', defaultValue: 'red', props: { options: [{ value: 'red', label: 'Red' }, { value: 'blue', label: 'Blue' }] } },
            { key: 'profile', fieldGroup: [{ key: 'name', type: 'string', defaultValue: 'Alice' }, { key: 'age', type: 'number' }] },
            { key: 'labels', type: 'tags', defaultValue: ['a'] },
            { key: 'rows', type: 'list', defaultValue: [{}], fieldArray: { fieldGroup: [{ key: 'name', type: 'string', defaultValue: 'x' }] } },
          ],
          advancedForm: [{ key: 'profile', fieldGroup: [{ key: 'bio', type: 'string' }] }],
        },
        defaults: { count: 3, profile: { age: 40, old: true }, stale: true },
      });

      async function twice(item: Locator, builder: Locator) {
        await generate(builder);
        const schema = await editorValue(item, 'schema');
        const defaults = await editorValue(item, 'defaults');
        await generate(builder);
        expect(await editorValue(item, 'schema')).toBe(schema);
        expect(await editorValue(item, 'defaults')).toBe(defaults);
      }

      let { item, builder } = await openBuilder(page, tag, type);
      await twice(item, builder);
      await save(page, item, type);
      const first = await get(request, origin, type, tag);
      expect(validate(first.schema, first.defaults)).toEqual([]);
      expect(first.defaults).toEqual({
        title: 'hi',
        count: 3,
        color: 'red',
        profile: { name: 'Alice', age: 40 },
        labels: ['a'],
        rows: [{ name: 'x' }],
      });

      ({ item, builder } = await openBuilder(page, tag, type));
      await twice(item, builder);
      await save(page, item, type);
      const second = await get(request, origin, type, tag);
      expect(second.config).toEqual(first.config);
      expect(second.schema).toEqual(first.schema);
      expect(second.defaults).toEqual(first.defaults);
    });
  }

  test('data typed into the generated form validates against the generated schema', async ({ page, request, origin }) => {
    test.setTimeout(120_000);
    const tag = await createPlugin(request, origin, 'data', { config: {} });
    const { item, builder } = await openBuilder(page, tag);
    const form = builder.locator('.builder-form');
    const label = async (row: Locator, text: string) => row.locator('.formly-label input').first().fill(text);
    await label(await addField(form, 'text', 'string'), 'FB Text:');
    await label(await addField(form, 'count', 'number'), 'FB Count:');
    await label(await addField(form, 'done', 'boolean'), 'FB Done:');
    const select = await addField(form, 'color', 'select');
    await label(select, 'FB Color:');
    await select.locator('.formly-placeholder input').first().fill('None');
    const options = select.locator('.formly-options');
    await options.locator('button', { hasText: '+ Add another option' }).click();
    await options.locator('.formly-option-value input').fill('red');
    await options.locator('.formly-option-label input').fill('Red');
    await label(await addField(form, 'labels', 'tags'), 'FB Labels:');
    const group = await addField(form, 'group');
    await label(await addField(group.locator('.formly-field-group'), 'nested', 'string'), 'FB Nested:');
    await builder.locator('button.generate-schema').click();
    await save(page, item);
    const saved = await getPlugin(request, origin, tag);
    expect(Object.keys(saved.schema.optionalProperties).sort()).toEqual(['color', 'count', 'done', 'group', 'labels', 'text']);

    // The server checks plugin data against the schema
    const bad = await request.post(`${api}/ref`, {
      headers: await headers(request),
      data: { url: `https://jasperkm.info/fb-bad-${runId}`, origin, tags: [tag], plugins: { [tag]: { count: 'many' } } },
    });
    expect(bad.ok()).toBeFalsy();

    async function submit(name: string, fill: (content: Locator) => Promise<void>) {
      await page.goto('/submit/web?debug=ADMIN&tag=' + encodeURIComponent(tag)
        + '&url=' + encodeURIComponent(`https://jasperkm.info/fb-${name}-${runId}`), { waitUntil: 'networkidle' });
      await page.locator('[name=title]').fill('Form Builder ' + name);
      const content = page.locator('.plugin-content');
      await expect(content.getByLabel('FB Text:', { exact: true })).toBeVisible();
      await fill(content);
      const submitPromise = page.waitForResponse(resp => (
        resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST'
      ));
      await page.locator('button', { hasText: 'Submit' }).click();
      const res = await submitPromise;
      expect(res.ok(), await res.text()).toBeTruthy();
      return res.request().postDataJSON().plugins[tag];
    }

    async function fillAll(content: Locator) {
      await content.getByLabel('FB Text:', { exact: true }).fill('hello');
      await content.getByLabel('FB Count:', { exact: true }).fill('3');
      await content.getByLabel('FB Done:', { exact: true }).check();
      await content.getByLabel('FB Color:', { exact: true }).selectOption({ label: 'Red' });
      await content.locator('button', { hasText: '+ Add another tag' }).click();
      await content.locator('.tag-field input:not(.preview)').first().fill('science');
      await content.getByLabel('FB Nested:', { exact: true }).fill('inside');
    }

    expect(await submit('filled', fillAll)).toEqual({
      text: 'hello',
      count: 3,
      done: true,
      color: 'red',
      labels: ['science'],
      group: { nested: 'inside' },
    });

    await submit('cleared', async content => {
      await fillAll(content);
      await content.getByLabel('FB Text:', { exact: true }).fill('');
      await content.getByLabel('FB Count:', { exact: true }).fill('');
      await content.getByLabel('FB Done:', { exact: true }).uncheck();
      await content.getByLabel('FB Color:', { exact: true }).selectOption({ label: 'None' });
      await removeButton(content.locator('.list-drag').first()).click();
      await content.getByLabel('FB Nested:', { exact: true }).fill('');
    });
  });

  test('nested structures survive a save and reload', async ({ page, request, origin }) => {
    test.setTimeout(120_000);
    const tag = await createPlugin(request, origin, 'nested', { config: {} });
    let { item, builder } = await openBuilder(page, tag);
    const form = builder.locator('.builder-form');
    const outer = await addField(form, 'outer');
    const inner = await addField(outer.locator('.formly-field-group'), 'inner');
    await addField(inner.locator('.formly-field-group'), 'leaf', 'string');
    await addField(form, 'a.b', 'number');
    const a = await addField(form, 'a');
    await addField(a.locator('.formly-field-group'), 'c', 'string');
    const advanced = await addField(builder.locator('.builder-advanced-form'), 'outer');
    await addField(advanced.locator('.formly-field-group'), 'extra', 'string');
    await generate(builder);
    await save(page, item);

    const expectedForm = [
      { key: 'outer', fieldGroup: [{ key: 'inner', fieldGroup: [{ key: 'leaf', type: 'string' }] }] },
      { key: 'a.b', type: 'number' },
      { key: 'a', fieldGroup: [{ key: 'c', type: 'string' }] },
    ];
    const expectedSchema = {
      optionalProperties: {
        outer: {
          optionalProperties: {
            inner: { optionalProperties: { leaf: { type: 'string' } } },
            extra: { type: 'string' },
          },
        },
        a: {
          optionalProperties: {
            b: { type: 'float64', nullable: true },
            c: { type: 'string' },
          },
        },
      },
    };
    const first = await getPlugin(request, origin, tag);
    expect(first.config.form).toEqual(expectedForm);
    expect(first.config.advancedForm).toEqual([{ key: 'outer', fieldGroup: [{ key: 'extra', type: 'string' }] }]);
    expect(first.schema).toEqual(expectedSchema);

    ({ item, builder } = await openBuilder(page, tag));
    const rows = builder.locator('.builder-form .formly-field-config');
    expect(await rows.locator('.formly-key input').evaluateAll(els => els.map(e => (e as HTMLInputElement).value)))
      .toEqual(['outer', 'inner', 'leaf', 'a.b', 'a', 'c']);
    expect(await builder.locator('.builder-advanced-form .formly-key input').evaluateAll(els => els.map(e => (e as HTMLInputElement).value)))
      .toEqual(['outer', 'extra']);
    await generate(builder);
    await save(page, item);
    const second = await getPlugin(request, origin, tag);
    expect(second.config).toEqual(first.config);
    expect(second.schema).toEqual(expectedSchema);
  });

  test('generated defaults are filled in when the plugin is used', async ({ page, request, origin }) => {
    const tag = await createPlugin(request, origin, 'used', {
      config: { form: [{ key: 'greeting', type: 'string', props: { label: 'FB Greeting:' } }] },
    });
    const { item, builder } = await openBuilder(page, tag);
    await builder.locator('button.generate-schema').click();
    await builder.locator('.defaults-form').getByLabel('FB Greeting:', { exact: true }).fill('from defaults');
    await builder.locator('button.generate-defaults').click();
    await save(page, item);
    expect((await getPlugin(request, origin, tag)).defaults).toEqual({ greeting: 'from defaults' });

    await page.goto('/submit/web?debug=ADMIN&tag=' + encodeURIComponent(tag)
      + '&url=' + encodeURIComponent(`https://jasperkm.info/fb-used-${runId}`), { waitUntil: 'networkidle' });
    await expect(page.locator('.plugin-content').getByLabel('FB Greeting:', { exact: true })).toHaveValue('from defaults');
  });

  test('opening the builder and saving changes nothing for built-in mods', async ({ page, request, origin }) => {
    test.setTimeout(900_000);
    await mod(page, ...[
      '#mod-root', '#mod-user', '#mod-kanban', '#mod-map', '[id="mod-plugin/embed"]', '#mod-blog', '#mod-poll',
      '#mod-feeds', '#mod-chat', '#mod-images', '#mod-pdf', '#mod-origin', '#mod-scrape', '#mod-aigeneration',
      '#mod-thumbnail', '#mod-todolist', '#mod-chess', '#mod-scripts', '[id="mod-plugin/qr"]', '[id="mod-plugin/video"]',
    ]);
    for (const type of ['plugin', 'template'] as const) {
      const res = await request.get(`${api}/${type}/page`, { headers: await headers(request), params: { query: origin, size: 500 } });
      expect(res.ok()).toBeTruthy();
      const entities = ((await res.json()).content as any[]).filter(e => !(e.tag ?? '').includes(runId)).map(e => ({ ...e, tag: e.tag ?? '' }));
      expect(entities.length).toBeGreaterThan(type === 'plugin' ? 20 : 5);
      for (const before of entities) {
        await test.step(`${type} ${before.tag}`, async () => {
          const { item, builder } = await openBuilder(page, before.tag, type);
          // Edit and revert a key in each form so the builder writes the whole config
          for (const form of ['.builder-form', '.builder-advanced-form', '.builder-admin-form', '.builder-advanced-admin-form']) {
            const key = builder.locator(form).locator('.formly-key input').first();
            if (!await key.count()) continue;
            const value = await key.inputValue();
            await key.fill(value + 'x');
            await key.fill(value);
          }
          await save(page, item, type);
          const after = await get(request, origin, type, before.tag);
          expect.soft(after.config, `${before.tag} config`).toEqual(before.config);
          expect.soft(after.schema, `${before.tag} schema`).toEqual(before.schema);
          expect.soft(after.defaults, `${before.tag} defaults`).toEqual(before.defaults);
        });
      }
    }
  });
});
