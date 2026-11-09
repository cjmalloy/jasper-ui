import { type APIRequestContext, expect } from '@playwright/test';
import { adminHeaders, localOrigin, mod, openSidebar, test } from './setup';

test.describe.serial('Secret Plugin', () => {
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-user', '#mod-secrets');
  });

  test('submits secrets without the public tag', async ({ page }) => {
    await page.goto('/tag/+plugin/secret?debug=ADMIN', { waitUntil: 'networkidle' });
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'secret' }).first().click();
    await expect(page).toHaveURL(/\/submit\/text/);
    const params = new URL(page.url()).searchParams;
    expect(params.getAll('inputTag')).toEqual(['+plugin,_plugin/secret/<Name>']);
    expect(params.get('url')).toMatch(/^internal:/);
    const tags = params.getAll('tag');
    expect(tags).not.toContain('+plugin/secret');
    expect(tags).toContain('internal');
    await expect(page.locator('.tabs a.current-tab')).toHaveText('text');
    await expect(page.locator('.tag-field input.preview[title="public"]')).toHaveCount(0);
  });

  test('asks for the secret name', async ({ page }) => {
    await page.goto('/tag/+plugin/secret?debug=ADMIN', { waitUntil: 'networkidle' });
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'secret' }).first().click();
    await expect(page).toHaveURL(/\/submit\/text/);
    const name = page.locator('.stencil input.tag-input');
    const prefix = page.locator('.stencil select.tag-choice');
    await expect(prefix.locator('option')).toHaveText(['🔑️ Secret', '🔒️ Private Secret']);
    await expect(prefix).toHaveValue('+plugin/secret');
    await expect(name).toHaveAttribute('placeholder', 'Name');
    await page.locator('#title').fill('OpenAI');
    await page.locator('.editor textarea').fill('key');
    await name.fill('openai');
    await name.blur();
    await expect(page.locator('.tag-field input.preview[title="+plugin/secret/openai"]')).toBeAttached();
    const created = page.waitForRequest(req => req.url().includes('/api/v1/ref') && req.method() === 'POST');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    const ref = (await created).postDataJSON();
    expect(ref.url).toMatch(/^internal:/);
    expect(ref.tags).toContain('+plugin/secret/openai');
    expect(ref.tags).not.toContain('+plugin/secret');
    expect(ref.tags).not.toContain('public');
    await expect(page).toHaveURL(/\/ref\//);
  });

  test('can make the secret private', async ({ page }) => {
    await page.goto('/tag/+plugin/secret?debug=ADMIN', { waitUntil: 'networkidle' });
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'secret' }).first().click();
    await expect(page).toHaveURL(/\/submit\/text/);
    await page.locator('#title').fill('Private');
    await page.locator('.editor textarea').fill('key');
    await page.locator('.stencil select.tag-choice').selectOption('_plugin/secret');
    await page.locator('.stencil input.tag-input').fill('private');
    await page.locator('.stencil input.tag-input').blur();
    await expect(page.locator('.tag-field input.preview[title="_plugin/secret/private"]')).toBeAttached();
    const created = page.waitForRequest(req => req.url().includes('/api/v1/ref') && req.method() === 'POST');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    const ref = (await created).postDataJSON();
    expect(ref.tags).toContain('_plugin/secret/private');
    expect(ref.tags).not.toContain('+plugin/secret');
    await expect(page).toHaveURL(/\/ref\//);
  });

  test('does not add the remembered public editor to secrets', async ({ page }) => {
    await page.goto('/tag/+plugin/secret?debug=ADMIN', { waitUntil: 'networkidle' });
    await openSidebar(page);
    const submit = page.locator('.sidebar .submit-button', { hasText: 'secret' }).first();
    await submit.click();
    await expect(page).toHaveURL(/\/submit\/text/);
    await page.locator('.editor textarea').click();
    const toggle = page.locator('.editor .toolbar button[title="Toggle 🌐️ Public or 👁️ Private"]');
    await expect(toggle).toHaveText('👁️');
    const saved = page.waitForResponse(res => res.url().includes('/api/v1/ext') && res.request().method() !== 'GET');
    await toggle.click();
    expect((await saved).ok()).toBe(true);
    await expect(toggle).toHaveText('👁️');
    await expect(page.locator('.tag-field input.preview[title="public"]')).toHaveCount(0);

    await page.goto('/tag/+plugin/secret?debug=ADMIN', { waitUntil: 'networkidle' });
    await openSidebar(page);
    await submit.click();
    await expect(page).toHaveURL(/\/submit\/text/);
    await page.locator('.editor textarea').fill('key');
    await page.locator('.stencil input.tag-input').fill('openai');
    await page.locator('.stencil input.tag-input').blur();
    await expect(page.locator('.tag-field input.preview[title="+plugin/secret/openai"]')).toBeAttached();
    await expect(toggle).toHaveText('👁️');
    await expect(page.locator('.tag-field input.preview[title="public"]')).toHaveCount(0);
  });

  test('drops the public tag from secrets', async ({ page }) => {
    await page.goto('/submit/text?debug=ADMIN&tag=public&tag=' + encodeURIComponent('+plugin/secret/openai'), { waitUntil: 'networkidle' });
    await expect(page.locator('.tag-field input.preview[title="+plugin/secret/openai"]')).toBeAttached();
    await expect(page.locator('.tag-field input.preview[title="public"]')).toHaveCount(0);
  });

  test('warns when a secret is public', async ({ page, request }) => {
    const res = await request.post(`${api}/ref`, {
      headers: await headers(request),
      data: { url: 'internal:public-secret', origin: localOrigin(), title: 'Public Secret', tags: ['public', '+plugin/secret/leaked'] },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    await page.goto(`/ref/e/${encodeURIComponent('internal:public-secret')}?debug=ADMIN`, { waitUntil: 'networkidle' });
    await expect(page.locator('.full-page.ref .secret-public')).toHaveText('⚠️ This secret is public');
  });

  test('warns when a private secret is public', async ({ page, request }) => {
    const res = await request.post(`${api}/ref`, {
      headers: await headers(request),
      data: { url: 'internal:public-private-secret', origin: localOrigin(), title: 'Public Private Secret', tags: ['public', '_plugin/secret/leaked'] },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    await page.goto(`/ref/e/${encodeURIComponent('internal:public-private-secret')}?debug=ADMIN`, { waitUntil: 'networkidle' });
    await expect(page.locator('.full-page.ref .info .icon', { hasText: '🔑️' })).toBeVisible();
    await expect(page.locator('.full-page.ref .secret-public')).toHaveText('⚠️ This secret is public');
  });

  test('lists protected and private secrets in one settings tab', async ({ page }) => {
    for (const tag of ['+plugin/secret', '_plugin/secret']) {
      await page.goto(`/settings/ref/${tag}?debug=ADMIN`, { waitUntil: 'networkidle' });
      await expect(page.locator('.settings-tab', { hasText: 'secrets' })).toHaveCount(1);
      await expect(page.locator('.settings-tab.current-tab')).toHaveText('secrets');
      await expect(page.locator('.ref-list .ref .link a', { hasText: 'OpenAI' }).first()).toBeVisible();
      await expect(page.locator('.ref-list .ref .link a', { hasText: 'Private' }).first()).toBeVisible();
    }
  });

  test('shows a submit button for each secret plugin in settings', async ({ page }) => {
    for (const [i, inputTag, value] of [
      [0, '+plugin,_plugin/secret/<Name>', '+plugin/secret'],
      [1, '_plugin,+plugin/secret/<Name>', '_plugin/secret'],
    ] as const) {
      await page.goto('/settings/ref/+plugin/secret?debug=ADMIN', { waitUntil: 'networkidle' });
      await openSidebar(page);
      const submits = page.locator('.sidebar .submit-button.plugin-submit');
      await expect(submits).toHaveText([/🔑️ secret/, /🔒️ private secret/]);
      await submits.nth(i).click();
      await expect(page).toHaveURL(/\/submit\/text/);
      const params = new URL(page.url()).searchParams;
      expect(params.getAll('inputTag')).toEqual([inputTag]);
      expect(params.get('url')).toMatch(/^internal:/);
      expect(params.getAll('tag')).not.toContain('+plugin/secret');
      expect(params.getAll('tag')).not.toContain('_plugin/secret');
      await expect(page.locator('.stencil select.tag-choice')).toHaveValue(value);
    }
  });
});
