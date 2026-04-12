import { expect, test } from '@playwright/test';

test.describe.serial('AI plugin form', () => {
  test('enable ai mod', async ({ page }) => {
    await page.goto('/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    const ai = page.getByRole('checkbox', { name: '✨️ AI Generation' });
    if (!await ai.isChecked()) {
      await ai.check();
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Success.').first()).toBeVisible();
    }
  });

  test('api key tag field uses the configured prefix as a stored value', async ({ page }) => {
    await page.goto('/submit/text?debug=ADMIN', { waitUntil: 'networkidle' });

    await page.locator('button', { hasText: '+ Add another tag' }).click();
    await page.locator('.tag-field input.grow:not(.preview)').nth(1).fill('plugin/llm');

    const advanced = page.locator('.advanced.plugin_llm');
    await advanced.getByText('Advanced').click();

    const apiField = advanced.locator('.tag-field').first();
    const apiInput = apiField.locator('input.grow:not(.preview)');
    await apiInput.fill('custom');
    await advanced.getByText('Model:').click();

    await expect(apiField.locator('input.preview')).toHaveAttribute('title', '+plugin/secret/custom');
    await expect(apiInput).toHaveValue('custom');
  });
});
