import { expect, test } from '@playwright/test';
import { mod } from './setup';

test.describe.serial('HTML to Markdown converter', () => {
  test('enable the converter', async ({ page }) => {
    await mod(page, '#mod-html-markdown');
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`converts long code blocks in the ${theme} theme`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto('/submit/text?debug=ADMIN', { waitUntil: 'networkidle' });
      await expect(page.locator('body')).toHaveClass(new RegExp(`${theme}-theme`));

      const code = Array.from({ length: 10 }, (_, index) => `static float clamp_${index}(float value)
{
    if (value < 1e-4f && value > 0)
    {
        return value * 2;
    }

    return 0;
}
`).join('\n');
      const html = '<p>Before <code>value</code>.</p><pre><code>' +
        code.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') +
        '</code></pre><p>After.</p>';
      const editor = page.locator('.fill-editor .editor');
      const textarea = editor.locator('.text-wrapper textarea');
      await textarea.fill(html);
      await editor.getByTitle('Convert HTML to Markdown', { exact: true }).click();
      await expect(textarea).toHaveValue('Before `value`.\n\n```\n' + code + '```\n\nAfter.');

      if (!await editor.locator('.md').isVisible()) {
        await editor.getByTitle('Show preview', { exact: true }).click();
      }
      const renderedCode = editor.locator('.md pre code');
      await expect(renderedCode).toHaveCount(1);
      await expect.poll(() => renderedCode.textContent()).toBe(code);
      await expect(editor.locator('.md')).toContainText('After.');
      const screenshot = testInfo.outputPath(`html-to-markdown-${theme}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      await testInfo.attach(`${theme} theme`, { path: screenshot, contentType: 'image/png' });
    });
  }
});
