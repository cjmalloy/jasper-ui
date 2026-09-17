import { expect, test } from '@playwright/test';
import { clearMods, deleteRef, mod } from './setup';

test.describe.serial('BBCode plugin', () => {
  test('enable BBCode', async ({ page }) => {
    await mod(page, '[id="mod-plugin/bb"]');
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`edits, previews, and saves BBCode in the ${theme} theme`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto('/submit/text?debug=ADMIN', { waitUntil: 'networkidle' });
      await expect(page.locator('body')).toHaveClass(new RegExp(`${theme}-theme`));
      await page.locator('#title').fill(`BBCode ${theme} test`);
      const editor = page.locator('.fill-editor .editor');
      const textarea = editor.locator('.text-wrapper textarea');
      const toggle = editor.locator('.editor-toggle label').filter({ hasText: 'BBCode' });
      const text = '[b]Bold [i]nested[/i][/b]\n[quote]Quoted[/quote]\n'
        + '[list][*]First[*]Second[/list]\n[code][b]literal[/b][/code]\n'
        + '[url=https://example.com/]Example[/url]\n**Markdown**\n'
        + '[url]tag:/bbcode-test[/url]\n[url=ftp://example.com/file]Download[/url]\n'
        + '<script>alert(1)</script>[url=javascript:alert(1)]unsafe link[/url]';
      await textarea.fill(text);
      if (!await editor.locator('.md').isVisible()) {
        await editor.getByTitle('Show preview', { exact: true }).click();
      }
      await expect(editor.locator('.md strong')).toHaveText('Markdown');
      await toggle.click();
      const preview = editor.locator('.bbcode');
      await expect(preview.locator('strong em')).toHaveText('nested');
      await expect(preview.locator('blockquote')).toHaveText('Quoted');
      await expect(preview.locator('li')).toHaveText(['First', 'Second']);
      await expect(preview.locator('pre code')).toHaveText('[b]literal[/b]');
      await expect(preview).toContainText('**Markdown**');
      await expect(preview.getByRole('link', { name: 'tag:/bbcode-test', exact: true })).toBeVisible();
      await expect(preview.getByRole('link', { name: 'Download', exact: true })).toHaveAttribute('href', 'ftp://example.com/file');
      await expect(preview.locator('script, a[href^="javascript:"]')).toHaveCount(0);
      await expect(textarea).toHaveValue(text);

      await toggle.click();
      await expect(editor.locator('.bbcode')).toHaveCount(0);
      await expect(editor.locator('.md strong')).toHaveText('Markdown');
      await toggle.click();
      await expect(preview.locator('strong em')).toHaveText('nested');
      const editorScreenshot = testInfo.outputPath(`bbcode-editor-${theme}.png`);
      await page.screenshot({ path: editorScreenshot, fullPage: true });
      await testInfo.attach(`BBCode editor ${theme}`, { path: editorScreenshot, contentType: 'image/png' });

      const save = page.waitForResponse(response => response.url().includes('/api/v1/ref')
        && response.request().method() === 'POST' && response.ok());
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      const ref = (await save).request().postDataJSON();
      expect(ref.tags).toContain('plugin/bb');
      expect(ref.comment).toBe(text);
      await page.goto(`/ref/e/${encodeURIComponent(ref.url)}?debug=ADMIN`, { waitUntil: 'networkidle' });
      const viewer = page.locator('.full-page.ref .bbcode');
      await expect(viewer.locator('strong em')).toHaveText('nested');
      await expect(viewer.locator('a', { hasText: 'Example' })).toHaveAttribute('href', 'https://example.com/');
      await expect(viewer.getByRole('link', { name: 'tag:/bbcode-test', exact: true })).toBeVisible();
      await expect(viewer.getByRole('link', { name: 'Download', exact: true })).toHaveAttribute('href', 'ftp://example.com/file');
      await expect(viewer).toContainText('**Markdown**');
      await expect(viewer.locator('script, a[href^="javascript:"]')).toHaveCount(0);
      const viewerScreenshot = testInfo.outputPath(`bbcode-viewer-${theme}.png`);
      await page.screenshot({ path: viewerScreenshot, fullPage: true });
      await testInfo.attach(`BBCode viewer ${theme}`, { path: viewerScreenshot, contentType: 'image/png' });

      await page.locator('.full-page.ref .actions .fake-link', { hasText: /^edit$/ }).first().click();
      await expect(page.locator('.editor .text-wrapper textarea')).toHaveValue(text);
      await expect(page.locator('.editor .editor-toggle label', { hasText: 'BBCode' })).toHaveClass(/on/);
      await deleteRef(page, ref.url);
    });
  }

  test('uninstall restores the ordinary Markdown editor', async ({ page }) => {
    await clearMods(page);
    await page.goto('/submit/text?debug=ADMIN', { waitUntil: 'networkidle' });
    const editor = page.locator('.fill-editor .editor');
    await expect(editor.locator('.editor-toggle label', { hasText: 'BBCode' })).toHaveCount(0);
    await editor.locator('.text-wrapper textarea').fill('**Markdown**');
    if (!await editor.locator('.md').isVisible()) {
      await editor.getByTitle('Show preview', { exact: true }).click();
    }
    await expect(editor.locator('.md strong')).toHaveText('Markdown');
  });
});
