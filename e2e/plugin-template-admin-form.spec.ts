import { type APIRequestContext, expect, type Locator } from '@playwright/test';
import { adminHeaders, test } from './setup';

test.describe.serial('Plugin/Template Admin Form', () => {
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  const runId = Date.now().toString(36);
  const tags = {
    plugin: `plugin/adminform${runId}`,
    template: `adminform${runId}`,
    config: `_config/server/fallback${runId}`,
  };

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  test('setup', async ({ request, origin }) => {
    for (const type of ['plugin', 'template'] as const) {
      const res = await request.post(`${api}/${type}`, {
        headers: await headers(request),
        data: {
          tag: tags[type],
          origin,
          name: 'Admin Form Test',
          config: {
            title: 'before',
            other: true,
            aiInstructions: '# Admin Form Test',
            adminForm: [
              { key: 'title', type: 'string', props: { label: 'Admin Title:' } },
              { key: 'aiInstructions', type: 'editor', props: { label: 'AI Instructions:' } },
            ],
            advancedAdminForm: [{ key: 'script', type: 'code', props: { label: 'Script:' } }],
          },
        },
      });
      expect(res.ok()).toBeTruthy();
    }
    const res = await request.post(`${api}/template`, {
      headers: await headers(request),
      data: { tag: tags.config, origin, config: { emailHost: 'smtp.example.com', maxSources: 5 } },
    });
    expect(res.ok()).toBeTruthy();
  });

  for (const type of ['plugin', 'template'] as const) {
    test(`edit ${type} config with admin form`, async ({ page, request, origin }) => {
      await page.goto(`/settings/${type}?debug=ADMIN&search=adminform${runId}`, { waitUntil: 'networkidle' });
      const item = page.locator(`.${type}.list-item`);
      await expect(item).toHaveCount(1);
      await item.locator('.actions .fake-link', { hasText: 'edit' }).click();

      const title = item.locator('.admin-form input[name=title]');
      await expect(title).toHaveValue('before');
      await expect(item.locator('.admin-form .editor-field')).toHaveCount(1);
      await expect(item.locator('.admin-form .editor-field textarea')).toHaveValue('# Admin Form Test');
      const advanced = item.locator('details.admin-advanced');
      await expect(advanced).not.toHaveAttribute('open');
      await expect(advanced.locator('.json-editor')).toHaveCount(1);
      await expect(advanced.locator('.advanced-admin-form .code-editor')).toHaveCount(1);

      await advanced.locator('summary').click();
      await expect(advanced).toHaveAttribute('open');
      const editor = advanced.locator('.json-editor ngx-monaco-editor');
      await expect(editor).toBeVisible();
      await expect.poll(async () => (await advanced.boundingBox())!.height).toBeGreaterThan(400);
      await editor.scrollIntoViewIfNeeded();
      const before = (await editor.boundingBox())!;
      await page.mouse.move(before.x + before.width - 3, before.y + before.height - 3);
      await page.mouse.down();
      await page.mouse.move(before.x + before.width + 200, before.y + before.height + 50, { steps: 5 });
      await page.mouse.up();
      await expect.poll(async () => (await editor.boundingBox())!.width).toBeGreaterThan(before.width + 100);
      const resized = (await editor.boundingBox())!;
      const details = (await advanced.boundingBox())!;
      expect(resized.x + resized.width).toBeLessThanOrEqual(details.x + details.width);
      expect(resized.y + resized.height).toBeLessThanOrEqual(details.y + details.height);

      await title.fill('after');
      const savePromise = page.waitForResponse(resp => (
        resp.url().includes(`/api/v1/${type}`) && resp.request().method() === 'PUT' && resp.ok()
      ));
      await item.locator('button[type=submit]').click();
      await savePromise;

      const res = await request.get(`${api}/${type}`, { headers: await headers(request), params: { tag: tags[type] + origin } });
      expect(res.ok()).toBeTruthy();
      const saved = await res.json();
      expect(saved.config.title).toBe('after');
      expect(saved.config.other).toBe(true);
      expect(saved.config.adminForm).toHaveLength(2);
      expect(saved.config.aiInstructions).toBe('# Admin Form Test');
    });
  }

  for (const type of ['plugin', 'template'] as const) {
    test(`reopening ${type} editor after save is not a draft`, async ({ page }) => {
      await page.goto(`/settings/${type}?debug=ADMIN&search=adminform${runId}`, { waitUntil: 'networkidle' });
      const item = page.locator(`.${type}.list-item`);
      const edit = item.locator('.actions .fake-link', { hasText: 'edit' });
      await edit.click();
      await expect(item.locator('.json-editor .monaco-editor')).toHaveCount(1);
      const savePromise = page.waitForResponse(resp => (
        resp.url().includes(`/api/v1/${type}`) && resp.request().method() === 'PUT' && resp.ok()
      ));
      await item.locator('button[type=submit]').click();
      await savePromise;
      await expect(item.locator('form')).toHaveCount(0);

      // Monaco is loaded now, so the editor writes the form value into itself after it opens
      await edit.click();
      await expect(item.locator('.json-editor .monaco-editor')).toHaveCount(1);
      await expect(item.locator('.json-editor .view-lines')).toContainText('adminForm');
      await expect(edit).toHaveText('edit');

      const dialogs: string[] = [];
      page.on('dialog', dialog => {
        dialogs.push(dialog.message());
        return dialog.dismiss();
      });
      await page.locator('a.logo').click();
      await expect(page).not.toHaveURL(/\/settings\//);
      expect(dialogs).toEqual([]);
    });
  }

  for (const type of ['plugin', 'template'] as const) {
    test(`build ${type} form in the UI`, async ({ page, request, origin }) => {
      await page.goto(`/settings/${type}?debug=ADMIN&search=adminform${runId}`, { waitUntil: 'networkidle' });
      const item = page.locator(`.${type}.list-item`);
      await expect(item).toHaveCount(1);
      await item.locator('.actions .fake-link', { hasText: 'edit' }).click();

      const builder = item.locator('details.form-builder');
      await expect(builder).not.toHaveAttribute('open');
      await builder.locator('summary').click();
      const form = builder.locator('.builder-form');
      await form.locator('button', { hasText: '+ Add another field' }).click();
      const field = form.locator('.formly-field-config');
      await expect(field).toHaveCount(1);
      await field.locator('.formly-key input').fill('color');
      await expect(field.locator('.formly-options')).toHaveCount(0);
      await field.locator('.formly-type select').selectOption('select');
      await field.locator('.formly-label input').first().fill('Color:');
      const options = field.locator('.formly-options');
      await options.locator('button', { hasText: '+ Add another option' }).click();
      await options.locator('.formly-option-value input').fill('red');
      await options.locator('.formly-option-label input').fill('Red');

      await builder.locator('button.generate-schema').click();
      const defaults = builder.locator('.defaults-form');
      await expect(defaults.locator('select option', { hasText: 'Red' })).toHaveCount(1);
      await defaults.locator('select').selectOption({ label: 'Red' });
      await builder.locator('button.generate-defaults').click();

      const savePromise = page.waitForResponse(resp => (
        resp.url().includes(`/api/v1/${type}`) && resp.request().method() === 'PUT' && resp.ok()
      ));
      await item.locator('button[type=submit]').click();
      await savePromise;

      const res = await request.get(`${api}/${type}`, { headers: await headers(request), params: { tag: tags[type] + origin } });
      expect(res.ok()).toBeTruthy();
      const saved = await res.json();
      expect(saved.config.form).toEqual([{
        key: 'color',
        type: 'select',
        props: { label: 'Color:', options: [{ value: 'red', label: 'Red' }] },
      }]);
      expect(saved.schema).toEqual({ optionalProperties: { color: { enum: ['red'] } } });
      expect(saved.defaults).toEqual({ color: 'red' });
      expect(saved.config.title).toBe('after');
      expect(saved.config.adminForm).toHaveLength(2);
    });
  }

  test('fallback admin form for server config template', async ({ page }) => {
    await page.goto(`/settings/template?debug=ADMIN&search=${tags.config}`, { waitUntil: 'networkidle' });
    const item = page.locator('.template.list-item').filter({ hasText: tags.config });
    await expect(item).toHaveCount(1);
    await item.locator('.actions .fake-link', { hasText: 'edit' }).click();

    await expect(item.locator('.admin-form input[name=emailHost]')).toBeVisible();
    await expect(item.locator('.admin-form input[name=maxSources]')).toHaveAttribute('type', 'number');
    await expect(item.locator('details.admin-advanced .json-editor')).toHaveCount(1);
  });

  test('suggests hot tags and hot plugins from mods in every origin', async ({ page, request, origin }) => {
    const tenant = origin + '.tenant';
    // A tenant admin installs a custom mod in their own origin
    const plugin = await request.post(`${api}/plugin`, {
      headers: { ...await headers(request), 'Local-Origin': tenant },
      data: {
        tag: 'plugin/custom',
        origin: tenant,
        config: {
          sorts: [
            { sort: 'tags->plugin/custom:num', label: 'custom' },
            { sort: 'tags->plugin/custom/rank:num', label: 'custom rank' },
          ],
          filters: [
            { sort: 'tags->plugin/custom:num', after: '1', label: 'custom over' },
            { sort: 'plugins->plugin/custom->size:num', after: '1', label: 'custom size over' },
          ],
        },
      },
    });
    expect(plugin.ok(), await plugin.text()).toBeTruthy();
    const res = await request.post(`${api}/template`, {
      headers: await headers(request),
      data: { tag: '_config/index', origin, config: { hotTags: ['plugin/custom:num', ''], hotPlugins: [''] } },
    });
    expect(res.ok(), await res.text()).toBeTruthy();

    await page.goto('/settings/template?debug=ADMIN&search=_config/index', { waitUntil: 'networkidle' });
    const item = page.locator('.template.list-item').filter({ hasText: '_config/index' });
    await expect(item).toHaveCount(1);
    const edit = item.locator('.actions .fake-link', { hasText: 'edit' });
    await edit.click();

    // Unset flags show the server default (enabled) without making the form a draft
    const checkboxes = item.locator('.admin-form input[type=checkbox]');
    await expect(checkboxes).toHaveCount(14);
    for (const checkbox of await checkboxes.all()) await expect(checkbox).toBeChecked();
    await expect(edit).toHaveText('edit');

    const inputs = item.locator('.admin-form input[list$=-suggestions]');
    await expect(inputs).toHaveCount(3);
    const options = async (index: number) => {
      const input = inputs.nth(index);
      await input.focus();
      return page.locator(`datalist[id="${await input.getAttribute('list')}"] option`);
    };
    // Editing a hot tag suggests its own value
    const values = (options: Locator) => options.evaluateAll(os => os.map(o => (o as HTMLOptionElement).value));
    await expect.poll(async () => values(await options(0))).toEqual(['plugin/custom/rank:num', 'plugin/custom:num']);
    await expect.poll(async () => values(await options(2))).toEqual(['plugin/custom->size:num']);
    // A new hot tag skips values already in the list (blank items are removed on blur, so check this last)
    await expect.poll(async () => values(await options(1))).toEqual(['plugin/custom/rank:num']);
  });
});
