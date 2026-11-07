/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, Subject } from 'rxjs';
import { AdminService } from './admin.service';
import { ExtService } from './api/ext.service';
import { EditorService } from './editor.service';

describe('repro', () => {
  it('previews', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withXhr(), withInterceptorsFromDi()), provideHttpClientTesting(), provideRouter([])] });
    const service = TestBed.inject(EditorService);
    const admin = TestBed.inject(AdminService) as any;
    for (const [k, v] of Object.entries(admin.def.templates)) admin.updateStatus((s: any) => s.templates[k] = v);
    for (const [k, v] of Object.entries(admin.def.plugins)) admin.updateStatus((s: any) => s.plugins[k] = v);
    const exts = TestBed.inject(ExtService);
    vi.spyOn(exts['stomp'], 'watchExt').mockReturnValue(new Subject<any>());
    for (const o of ['', '@t']) for (const tag of ['plugin/inbox/support', '+support', 'support', 'plugin/outbox/support', 'dm', 'plugin/thread']) {
      exts.prefillCache(exts.defaultExt(tag, o));
    }
    for (const o of ['', '@t']) for (const tag of ['plugin/inbox/support', '+support', 'support']) {
      process.stdout.write('\n' + ['PREVIEW', o, tag, JSON.stringify(await firstValueFrom(service.getTagPreview(tag, o)))].join(' ') + '\n');
    }
  });
});
