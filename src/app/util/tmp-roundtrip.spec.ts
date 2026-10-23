/// <reference types="vitest/globals" />
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { mapPlugin } from '../model/plugin';
import { mapTemplate } from '../model/template';
import { AdminService } from '../service/admin.service';
import { signJwt } from './jwt';
import { equalBundle, formatBundleDiff, mergeBundle } from './diff';
import { modId } from './format';

(globalThis as any).__log = (...a: any[]) => { (globalThis as any).__out = ((globalThis as any).__out || '') + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ') + '\n'; };
describe('roundtrip', () => {
  it('roundtrip', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const admin = TestBed.inject(AdminService);
    const secret = atob('MjY0ZWY2ZTZhYmJhMTkyMmE5MTAxMTg3Zjc2ZDlmZWUwYjk0MDgzODA0MDJiOTgyNTk4MmNjYmQ4Yjg3MmVhYjk0MmE0OGFmNzE2YTQ5ZjliMTEyN2NlMWQ4MjA5OTczYjU2NzAxYTc4YThkMzYxNzdmOTk5MTIxODZhMTkwMDM=');
    const jwt = await signJwt({ verified_email: true, sub: 'debug', auth: 'ROLE_ADMIN' }, new TextEncoder().encode(secret));
    const api = 'http://localhost:8081/api/v1/';
    const h = { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json', 'Cookie': 'XSRF-TOKEN=abc', 'X-XSRF-TOKEN': 'abc' };
    const bad: string[] = [];
    const ids = new Map<string, number>();
    for (const b of admin.mods) for (const id of new Set([...(b.plugin||[]), ...(b.template||[])].map(modId))) ids.set(id, (ids.get(id) || 0) + 1);
    for (const b of admin.mods) { const s = new Set([...(b.plugin||[]), ...(b.template||[])].map(modId)); if (s.size > 1) (globalThis as any).__log('MULTI', [...s]); }
    for (const [k, v] of ids) if (v > 1) (globalThis as any).__log('DUP', k, v);
    for (const b of admin.mods) if (b.ref?.length || b.ext?.length || b.user?.length) (globalThis as any).__log('HASENT', modId((b.plugin || b.template)![0]));
    for (const bundle of admin.mods) {
      const mod = modId((bundle.plugin || bundle.template)![0]);
      const current: any = { ...bundle, plugin: [], template: [] };
      for (const p of bundle.plugin || []) {
        await fetch(api + 'plugin?tag=' + encodeURIComponent(p.tag), { method: 'DELETE', headers: h });
        const r = await fetch(api + 'plugin', { method: 'POST', headers: h, body: JSON.stringify({ ...p, origin: '' }) });
        if (!r.ok) (globalThis as any).__log('fail plugin', p.tag, r.status, await r.text());
        current.plugin.push(mapPlugin(await (await fetch(api + 'plugin?tag=' + encodeURIComponent(p.tag), { headers: h })).json()));
      }
      for (const t of bundle.template || []) {
        await fetch(api + 'template?tag=' + encodeURIComponent(t.tag), { method: 'DELETE', headers: h });
        const r = await fetch(api + 'template', { method: 'POST', headers: h, body: JSON.stringify({ ...t, origin: '' }) });
        if (!r.ok) (globalThis as any).__log('fail template', t.tag, r.status, await r.text());
        current.template.push(mapTemplate(await (await fetch(api + 'template?tag=' + encodeURIComponent(t.tag), { headers: h })).json()));
      }
      const url = 'mod-receipt:' + mod;
      await fetch(api + 'ref?url=' + encodeURIComponent(url), { method: 'DELETE', headers: h });
      const rr = await fetch(api + 'ref', { method: 'POST', headers: h, body: JSON.stringify({ url, origin: '', title: mod, tags: ['internal', 'plugin/mod/receipt'], plugins: { 'plugin/mod': bundle } }) });
      if (!rr.ok) (globalThis as any).__log('fail ref', mod, rr.status, (await rr.text()).substring(0, 300));
      const ref = await (await fetch(api + 'ref?url=' + encodeURIComponent(url), { headers: h })).json();
      const receipt = ref.plugins?.['plugin/mod'];
      if (!receipt) { (globalThis as any).__log('NORECEIPT', mod, JSON.stringify(ref).substring(0,300)); continue; }
      if (formatBundleDiff(current) !== formatBundleDiff(receipt)) (globalThis as any).__log('STRICT', mod);
      const m = mergeBundle(current, receipt, bundle);
      if (m.conflict) (globalThis as any).__log('CONFLICT', mod);
      else if (!equalBundle(m.result, bundle)) (globalThis as any).__log('MERGEDIFF', mod);
      if (!equalBundle(current, receipt)) {
        bad.push(mod);
        const a = formatBundleDiff(current, false).split('\n'), b = formatBundleDiff(receipt, false).split('\n');
        const i = a.findIndex((l, i) => l !== b[i]);
        (globalThis as any).__log('DIFF', mod, i, JSON.stringify(a.slice(i - 3, i + 3)), JSON.stringify(b.slice(i - 3, i + 3)));
      }
    }
    (globalThis as any).__log('BAD', bad.length, '/', admin.mods.length, bad);
    expect((globalThis as any).__out).toBe('');
  }, 600000);
});
