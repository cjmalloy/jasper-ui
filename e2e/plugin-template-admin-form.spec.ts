import { type APIRequestContext, expect, test } from '@playwright/test';
import { adminHeaders } from './setup';

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

  test.afterAll(async ({ request }) => {
    await request.delete(`${api}/plugin`, { headers: await headers(request), params: { tag: tags.plugin } });
    await request.delete(`${api}/template`, { headers: await headers(request), params: { tag: tags.template } });
    await request.delete(`${api}/template`, { headers: await headers(request), params: { tag: tags.config } });
  });

  test('setup', async ({ request }) => {
    for (const type of ['plugin', 'template'] as const) {
      const res = await request.post(`${api}/${type}`, {
        headers: await headers(request),
        data: {
          tag: tags[type],
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
      data: { tag: tags.config, config: { emailHost: 'smtp.example.com', maxSources: 5 } },
    });
    expect(res.ok()).toBeTruthy();
  });

  for (const type of ['plugin', 'template'] as const) {
    test(`edit ${type} config with admin form`, async ({ page, request }) => {
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

      const res = await request.get(`${api}/${type}`, { headers: await headers(request), params: { tag: tags[type] } });
      expect(res.ok()).toBeTruthy();
      const saved = await res.json();
      expect(saved.config.title).toBe('after');
      expect(saved.config.other).toBe(true);
      expect(saved.config.adminForm).toHaveLength(2);
      expect(saved.config.aiInstructions).toBe('# Admin Form Test');
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
});
