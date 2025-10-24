/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Ref } from '../model/ref';

import { OriginMapService } from './origin-map.service';

describe('OriginMapService', () => {
  let service: OriginMapService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    service = TestBed.inject(OriginMapService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
  // @ts-ignore
  const setOrigins = (origins: Ref[]) => service.origins = origins;
  // @ts-ignore
  const setApi = (api: string) => service.config.api = api;
  // @ts-ignore
  const setLocal = (origin: string) => service.store.account.origin = origin;
  // @ts-ignore
  const selfApis = () => service.selfApis;
  // @ts-ignore
  const reverseLookup = () => service.reverseLookup;
  // @ts-ignore
  const originMap = () => service.originMap;
  const ref = (url: string, origin: string, local: string, remote = ''): Ref => ({
    url,
    origin,
    tags: ['+plugin/origin/pull'],
    plugins: { '+plugin/origin': { local, remote } },
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
