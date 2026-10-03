import { type APIRequestContext, expect, type Page, test } from '@playwright/test';
import { adminHeaders } from './setup';
import {
  ACTION_ITEM,
  ACTIONS,
  ENTITY,
  EXT,
  FULL_PAGE_REF,
  INFO,
  LINK,
  PLUGIN,
  REF_LIST_ITEM,
  TEMPLATE,
  THUMBNAIL,
  USER,
} from './selectors';

/**
 * Enforces the ref / tag row structure documented in docs/STRUCTURE.md:
 * every `.ref` / `.tag` row has `.thumbnail?` → `.link` → `.info` → `.actions`
 * in document order, and `.actions` only contains action elements.
 */
const selectors = { ENTITY, THUMBNAIL, LINK, INFO, ACTIONS, ACTION_ITEM };

function checkStructure(s: typeof selectors) {
  const errors: string[] = [];
  const roots = Array.from(document.querySelectorAll<HTMLElement>(s.ENTITY));
  const describe = (el: Element) => el.tagName.toLowerCase() + '.' + Array.from(el.classList).join('.');
  const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  for (const root of roots) {
    const own = (sel: string) => Array.from(root.querySelectorAll(sel)).find(e => e.closest(s.ENTITY) === root);
    const name = describe(root);
    const thumbnail = own(s.THUMBNAIL);
    const link = own(s.LINK);
    const info = own(s.INFO);
    const actions = own(s.ACTIONS);
    if (!link) errors.push(`${name}: missing ${s.LINK}`);
    if (!info) errors.push(`${name}: missing ${s.INFO}`);
    if (thumbnail && link && !before(thumbnail, link)) errors.push(`${name}: ${s.THUMBNAIL} must come before ${s.LINK}`);
    if (link && info && !before(link, info)) errors.push(`${name}: ${s.LINK} must come before ${s.INFO}`);
    if (info && actions && !before(info, actions)) errors.push(`${name}: ${s.INFO} must come before ${s.ACTIONS}`);
    if (actions) {
      for (const child of Array.from(actions.children)) {
        if (!child.matches(s.ACTION_ITEM)) errors.push(`${name}: ${s.ACTIONS} contains non-action ${describe(child)}`);
      }
    }
  }
  return { count: roots.length, errors };
}

async function expectStructure(page: Page, rootSelector: string) {
  await page.locator('body:not(.init-theme)').waitFor();
  await expect(page.locator(rootSelector).first()).toBeVisible();
  const result = await page.evaluate(checkStructure, selectors);
  expect(result.count).toBeGreaterThan(0);
  expect(result.errors).toEqual([]);
}

test.describe.serial('Ref / Tag structure', () => {
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  const runId = Date.now().toString(36);
  const tag = `structuretest${runId}`;
  const url = `https://structure.test/${runId}`;
  const responseUrl = `https://structure.test/${runId}/response`;

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  test.afterAll(async ({ request }) => {
    await request.delete(`${api}/ref`, { headers: await headers(request), params: { url: responseUrl } });
    await request.delete(`${api}/ref`, { headers: await headers(request), params: { url } });
    await request.delete(`${api}/ext`, { headers: await headers(request), params: { tag } });
    await request.delete(`${api}/plugin`, { headers: await headers(request), params: { tag: `plugin/${tag}` } });
    await request.delete(`${api}/template`, { headers: await headers(request), params: { tag } });
    await request.delete(`${api}/user`, { headers: await headers(request), params: { tag: `+user/${tag}` } });
  });

  test('checker detects drift', async ({ page }) => {
    await page.setContent(`
      <div class="ref list-item"><div class="info"></div><div class="link"></div>
        <div class="actions"><a>ok</a><span class="not-an-action"></span></div></div>
      <div class="tag ext list-item"><div class="link"></div></div>
      <div class="tag plugin list-item"><div class="link"></div><div class="info"></div><div class="actions"><a class="fake-link">ok</a></div></div>`);
    const result = await page.evaluate(checkStructure, selectors);
    expect(result.count).toBe(3);
    expect(result.errors).toEqual([
      'div.ref.list-item: .link must come before .info',
      'div.ref.list-item: .actions contains non-action span.not-an-action',
      'div.tag.ext.list-item: missing .info',
    ]);
  });

  test('setup', async ({ request }) => {
    const posts: [string, object][] = [
      ['ref', { url, title: 'Structure Test', tags: ['public', tag] }],
      ['ref', { url: responseUrl, title: 'Structure Response', sources: [url], tags: ['public', tag] }],
      ['ext', { tag, name: 'Structure Test' }],
      ['plugin', { tag: `plugin/${tag}`, name: 'Structure Test' }],
      ['template', { tag, name: 'Structure Test' }],
      ['user', { tag: `+user/${tag}`, name: 'Structure Test' }],
    ];
    for (const [type, data] of posts) {
      const res = await request.post(`${api}/${type}`, { headers: await headers(request), data });
      expect(res.ok(), `create ${type}`).toBeTruthy();
    }
  });

  test('ref list: /tag/:tag', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=ADMIN`, { waitUntil: 'networkidle' });
    await expectStructure(page, REF_LIST_ITEM);
  });

  test('full page ref: /ref/:url', async ({ page }) => {
    await page.goto(`/ref/e/${encodeURIComponent(url)}?debug=ADMIN`, { waitUntil: 'networkidle' });
    await expectStructure(page, FULL_PAGE_REF);
  });

  test('ref responses: /ref/:url/responses', async ({ page }) => {
    await page.goto(`/ref/e/${encodeURIComponent(url)}/responses?debug=ADMIN`, { waitUntil: 'networkidle' });
    await expectStructure(page, REF_LIST_ITEM);
  });

  test('ref thread: /ref/:url/thread', async ({ page }) => {
    await page.goto(`/ref/e/${encodeURIComponent(url)}/thread?debug=ADMIN`, { waitUntil: 'networkidle' });
    await expectStructure(page, FULL_PAGE_REF);
  });

  test('ext list: /tags', async ({ page }) => {
    await page.goto(`/tags/@*?debug=ADMIN`, { waitUntil: 'networkidle' });
    await expectStructure(page, EXT);
  });

  test('plugin list: /settings/plugin', async ({ page }) => {
    await page.goto(`/settings/plugin?debug=ADMIN`, { waitUntil: 'networkidle' });
    await expectStructure(page, PLUGIN);
  });

  test('template list: /settings/template', async ({ page }) => {
    await page.goto(`/settings/template?debug=ADMIN`, { waitUntil: 'networkidle' });
    await expectStructure(page, TEMPLATE);
  });

  test('user list: /settings/user', async ({ page }) => {
    await page.goto(`/settings/user?debug=ADMIN`, { waitUntil: 'networkidle' });
    await expectStructure(page, USER);
  });
});
