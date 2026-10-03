/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Ref } from '../model/ref';
import { of } from 'rxjs';
import { Page } from '../model/page';
import { Store } from '../store/store';
import { AdminService } from './admin.service';
import { ConfigService } from './config.service';
import { RefService } from './api/ref.service';

import { OriginMapService } from './origin-map.service';

describe('OriginMapService', () => {
  let service: OriginMapService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    service = TestBed.inject(OriginMapService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('publishes replacement origin collections without modifying previous snapshots', () => {
    const store = TestBed.inject(Store);
    const admin = TestBed.inject(AdminService);
    const refs = TestBed.inject(RefService);
    const config = TestBed.inject(ConfigService);
    config.api = 'spec:test';
    const first = ref('spec:a', '', '@a');
    const nested = ref('spec:a', '@a', '@other');
    vi.spyOn(admin, 'getPlugin').mockReturnValue({ tag: '+plugin/origin' });
    const page = vi.spyOn(refs, 'page').mockReturnValueOnce(of(Page.of([first, nested])))
      .mockReturnValueOnce(of(Page.of([])));

    service.init$.subscribe();
    const origins = store.origins.origins();
    const lookup = store.origins.lookup();
    const originMap = store.origins.originMap();
    expect(lookup.get('@a')).toBe('spec:a');
    expect(originMap.get('@a')?.get('@other')).toBe('@a');

    const second = ref('spec:b', '', '@b');
    page.mockReturnValueOnce(of(Page.of([second]))).mockReturnValueOnce(of(Page.of([])));
    service.init$.subscribe();

    expect(store.origins.origins()).toEqual([second]);
    expect(store.origins.lookup().has('@a')).toBe(false);
    expect(store.origins.lookup().get('@b')).toBe('spec:b');
    expect(origins).toEqual([first, nested]);
    expect(lookup.get('@a')).toBe('spec:a');
    expect(originMap.get('@a')?.get('@other')).toBe('@a');
  });
  // @ts-ignore
  const setOrigins = (origins: Ref[]) => service.origins.set(origins);
  // @ts-ignore
  const setApi = (api: string) => service.config.api = api;
  // @ts-ignore
  const setLocal = (origin: string) => service.store.account.origin.set(origin);
  // @ts-ignore
  const selfApis = () => service.selfApis();
  // @ts-ignore
  const reverseLookup = () => service.reverseLookup();
  // @ts-ignore
  const originMap = () => service.originMap();
  const ref = (url: string, origin: string, local: string, remote = ''): Ref => ({
    url,
    origin,
    tags: ['+plugin/origin/pull'],
    plugins: { '+plugin/origin': { local, remote } },
  });

  it('recomputes origin lookups when origins or the active account origin change', () => {
    setApi('spec:test');
    setOrigins([
      ref('spec:a', '', '@a'),
      ref('spec:tenant', '@tenant', '@remote'),
    ]);
    const lookup = service['lookup'];
    const list = service['list'];
    const localLookup = lookup();
    expect(localLookup.get('@a')).toBe('spec:a');
    expect(list()).toEqual(['', '@a']);

    setLocal('@tenant');
    expect(lookup().get('@tenant')).toBe('spec:test');
    expect(lookup().get('@tenant.remote')).toBe('spec:tenant');
    expect(lookup().has('@a')).toBe(false);
    expect(list()).toEqual(['@tenant', '@tenant.remote']);
    expect(localLookup.get('@a')).toBe('spec:a');

    const previous = lookup();
    setOrigins([ref('spec:next', '@tenant', '@next')]);
    expect(lookup().get('@tenant.next')).toBe('spec:next');
    expect(lookup().has('@tenant.remote')).toBe(false);
    expect(previous.get('@tenant.remote')).toBe('spec:tenant');
  });

  it('reverseLookup on @other has named us @main', () => {
    setOrigins([
      ref('spec:test', '@other', '@main'),
    ]);
    setApi('spec:test');
    setLocal('');
    expect(reverseLookup().get('@other')).toEqual('@main');
  });
  it('reverseLookup on @other does not have an entry for our API', () => {
    setOrigins([
      ref('spec:test', '@other', '@main'),
    ]);
    setApi('spec:other');
    setLocal('');
    expect(reverseLookup().get('@other')).toBeFalsy();
  });
  it('reverseLookup on @other for tenant @mt has it named @main', () => {
    setOrigins([
      ref('spec:test', '@other', '@main', '@mt'),
    ]);
    setApi('spec:test');
    setLocal('@mt');
    expect(reverseLookup().get('@other')).toEqual('@main');
  });
  it('reverseLookup on @other does not have an entry for tenant @mt', () => {
    setOrigins([
      ref('spec:test', '@other', '@main', '@diff'),
    ]);
    setApi('spec:test');
    setLocal('@mt');
    expect(reverseLookup().get('@other')).toBeFalsy();
  });
  describe('OriginMapService origin mapping', () => {
    // Test originMap for nested tenants
    it('should map origins correctly in multi-tenant setup', () => {
      setOrigins([
        // Main -> Remote A
        ref('spec:a', '', '@remote.a'),
        // Main -> Remote B
        ref('spec:b', '', '@remote.b'),
        // Remote A -> Main
        ref('spec:test', '@remote.a', '@main'),
        // Remote A -> Remote B
        ref('spec:b', '@remote.a', '@remote.b'),
        // Remote B -> Main
        ref('spec:test', '@remote.b', '@main'),
        // Remote B -> Remote A
        ref('spec:a', '@remote.b', '@remote.a'),
      ]);
      setApi('spec:test');
      setLocal('');

      expect(originMap().get('@remote.a')?.get('@main') || '').toBe('');
      expect(originMap().get('@remote.b')?.get('@main') || '').toBe('');
      expect(originMap().get('@remote.a')?.get('@remote.b')).toBe('@remote.b');
      expect(originMap().get('@remote.b')?.get('@remote.a')).toBe('@remote.a');
    });
  });

});
