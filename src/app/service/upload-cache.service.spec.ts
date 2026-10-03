/// <reference types="vitest/globals" />
import { HttpResponse, provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import JSZip from 'jszip';
import { firstValueFrom, of, throwError } from 'rxjs';
import { Ref } from '../model/ref';
import { Store } from '../store/store';
import { ProxyService } from './api/proxy.service';
import { RefService } from './api/ref.service';
import { UploadCacheService } from './upload-cache.service';

describe('UploadCacheService', () => {
  let service: UploadCacheService;
  let store: Store;
  let save: ReturnType<typeof vi.fn>;
  let count = 0;

  beforeEach(async () => {
    count = 0;
    save = vi.fn(() => {
      count++;
      return of(new HttpResponse<Ref>({ body: { url: 'cache:new' + count, origin: '' } }));
    });
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ProxyService, useValue: { save } },
        { provide: RefService, useValue: { get: (url: string, origin: string) => of({ url, origin, modifiedString: 'modified' }) } },
      ]
    }).compileComponents();
    service = TestBed.inject(UploadCacheService);
    store = TestBed.inject(Store);
    const zip = new JSZip();
    zip.file('cache/old', 'data');
    store.submit.addCacheFiles(new Map([['old', zip.file('cache/old')!]]));
  });

  it('should leave Refs without bundled caches unchanged', async () => {
    const ref: Ref = { url: 'cache:other', origin: '' };
    expect(await firstValueFrom(service.restore$(ref, ''))).toBe(ref);
    expect(save).not.toHaveBeenCalled();
  });

  it('should upload a cache file and rewrite the Ref', async () => {
    const ref: Ref = { url: 'cache:old', origin: '', title: 'file.png' };
    const result = await firstValueFrom(service.restore$(ref, ''));
    expect(result.url).toBe('cache:new1');
    expect(result.exists).toBe(true);
    expect(result.modifiedString).toBe('modified');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('should only upload each cache file once', async () => {
    await firstValueFrom(service.restore$({ url: 'cache:old', origin: '' }, ''));
    const result = await firstValueFrom(service.restore$({
      url: 'https://example.com',
      origin: '',
      plugins: { 'plugin/image': { url: 'cache:old' } },
    }, ''));
    expect(result.plugins!['plugin/image'].url).toBe('cache:new1');
    expect(result.exists).toBeUndefined();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('should name the file after the cache Ref when another Ref restores it first', async () => {
    const comment: Ref = { url: 'comment:1', origin: '', comment: '![](cache:old)' };
    store.submit.clearUpload([{ url: 'cache:old', origin: '', title: 'file.png' }, comment]);
    await firstValueFrom(service.restore$(comment, ''));
    expect((save.mock.calls[0][0] as File).name).toBe('file.png');
  });

  it('should fall back to the cache ID for the file name', async () => {
    await firstValueFrom(service.restore$({ url: 'comment:1', origin: '', comment: '![](cache:old)' }, ''));
    expect((save.mock.calls[0][0] as File).name).toBe('old');
  });

  it('should forget mappings no longer referenced by the upload list', async () => {
    const ref: Ref = { url: 'cache:old', origin: '' };
    store.submit.clearUpload([ref]);
    await firstValueFrom(service.restore$(ref, ''));
    store.submit.clearUpload([ref]);
    expect((await firstValueFrom(service.restore$(ref, ''))).url).toBe('cache:new1');
    store.submit.clearUpload([]);
    expect(await firstValueFrom(service.restore$(ref, ''))).toBe(ref);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('should retry failed uploads', async () => {
    save.mockImplementationOnce(() => throwError(() => 'error'));
    const ref: Ref = { url: 'cache:old', origin: '' };
    await expect(firstValueFrom(service.restore$(ref, ''))).rejects.toBe('error');
    expect((await firstValueFrom(service.restore$(ref, ''))).url).toBe('cache:new1');
    expect(save).toHaveBeenCalledTimes(2);
  });
});
