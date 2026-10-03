import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'fs';
import JSZip from 'jszip';
import { mod } from './setup';

test.describe.serial('Bulk download cache files', () => {
  const tag = 'cachebundle' + Date.now();
  let oldUrl = '';
  let zipPath = '';

  test('enable file cache mod', async ({ page }) => {
    await mod(page, '#mod-cache', '#mod-filecache');
  });

  test('cache a file', async ({ page }) => {
    await page.goto('/submit/upload?debug=USER', { waitUntil: 'networkidle' });
    const saved = page.waitForResponse(res => res.url().includes('/api/v1/proxy') && res.request().method() === 'POST');
    await page.locator('.cache-upload-input').setInputFiles({
      name: 'hello.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello cache'),
    });
    const res = await saved;
    oldUrl = (await res.json()).url;
    expect(oldUrl).toMatch(/^cache:/);
    await expect(page.locator('.ref.upload')).toHaveCount(1);
    await page.locator('#add-tag').fill(tag);
    await page.locator('#add-tag').press('Enter');
    await page.getByRole('button', { name: 'upload all' }).click();
    await expect(page).toHaveURL(/\/ref\//);
  });

  test('bulk download includes cache files', async ({ page }, testInfo) => {
    await page.goto(`/tag/${tag}?filter=query/internal&debug=USER`, { waitUntil: 'networkidle' });
    await page.locator('.bulk summary').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.bulk .bulk-download').click();
    const download = await downloadPromise;
    zipPath = testInfo.outputPath('bundle.zip');
    await download.saveAs(zipPath);
    const zip = await JSZip.loadAsync(readFileSync(zipPath));
    const refs = JSON.parse(await zip.file('ref.json')!.async('string'));
    expect(refs.map((r: any) => r.url)).toEqual([oldUrl]);
    const id = oldUrl.substring('cache:'.length);
    expect(await zip.file('cache/' + id)!.async('string')).toBe('hello cache');
  });

  test('uploading a ref restores its cache with a new ID', async ({ page }) => {
    await page.goto('/submit/upload?debug=USER', { waitUntil: 'networkidle' });
    await page.locator('.upload-input').setInputFiles(zipPath);
    const ref = page.locator('.ref.upload');
    await expect(ref).toHaveCount(1);
    const saved = page.waitForResponse(res => res.url().includes('/api/v1/proxy') && res.request().method() === 'POST');
    await ref.locator('.actions').getByText('upload', { exact: true }).click();
    const newUrl = (await (await saved).json()).url;
    expect(newUrl).toMatch(/^cache:/);
    expect(newUrl).not.toBe(oldUrl);
    await expect(page).toHaveURL(url => decodeURIComponent(url.pathname) === '/ref/' + newUrl);
    const content = await page.evaluate(async url => {
      const res = await fetch('http://localhost:8081/api/v1/proxy?origin=&url=' + encodeURIComponent(url));
      return res.text();
    }, newUrl);
    expect(content).toBe('hello cache');
  });

  test('shared cache files are only uploaded once', async ({ page }, testInfo) => {
    const zip = await JSZip.loadAsync(readFileSync(zipPath));
    const refs = JSON.parse(await zip.file('ref.json')!.async('string'));
    const commentUrl = 'comment:' + tag;
    refs.push({ url: commentUrl, title: 'Shared', comment: `![](${oldUrl})`, tags: ['public', tag] });
    zip.file('ref.json', JSON.stringify(refs));
    const sharedPath = testInfo.outputPath('shared.zip');
    writeFileSync(sharedPath, await zip.generateAsync({ type: 'nodebuffer' }));

    await page.goto('/submit/upload?debug=USER', { waitUntil: 'networkidle' });
    let posts = 0;
    page.on('request', req => {
      if (req.url().includes('/api/v1/proxy') && req.method() === 'POST') posts++;
    });
    await page.locator('.upload-input').setInputFiles(sharedPath);
    await expect(page.locator('.ref.upload')).toHaveCount(2);
    const comment = page.locator('.ref.upload', { hasText: 'Shared' });
    const created = page.waitForResponse(res => res.url().includes('/api/v1/ref') && res.request().method() === 'POST');
    await comment.locator('.actions').getByText('upload', { exact: true }).click();
    const body = JSON.parse((await created).request().postData()!);
    const newUrl = body.comment.match(/\((cache:[^)]+)\)/)[1];
    expect(newUrl).not.toBe(oldUrl);
    await expect(page.locator('.ref.upload')).toHaveCount(1);

    const updated = page.waitForResponse(res => res.url().includes('/api/v1/ref') && res.request().method() === 'PUT');
    await page.getByRole('button', { name: 'upload all' }).click();
    expect(JSON.parse((await updated).request().postData()!).url).toBe(newUrl);
    await expect(page).toHaveURL(/\/ref\//);
    expect(posts).toBe(1);
  });
});
