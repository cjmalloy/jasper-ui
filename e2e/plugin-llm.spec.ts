import { expect } from '@playwright/test';
import { mod, test } from './setup';

test.describe.serial('LLM Config Plugin', () => {
  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-aigeneration');
  });

  test('picks the API key secret tag', async ({ page }) => {
    await page.goto('/submit/text?debug=ADMIN&tag=plugin/llm', { waitUntil: 'networkidle' });
    const advanced = page.locator('details.advanced.plugin_llm');
    await advanced.locator('summary').click();
    const field = advanced.locator('.stencil-field');
    const name = field.locator('input.tag-input');
    await expect(name).toHaveAttribute('placeholder', 'Name');
    await field.locator('select.tag-choice').selectOption('_plugin/secret');
    await name.fill('openai');
    await page.locator('#title').fill('LLM config');

    const created = page.waitForRequest(req => req.url().includes('/api/v1/ref') && req.method() === 'POST');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    const ref = (await created).postDataJSON();
    expect(ref.plugins['plugin/llm'].apiKeyTag).toBe('_plugin/secret/openai');
  });
});
