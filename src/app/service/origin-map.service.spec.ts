import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Ref } from '../model/ref';

import { OriginMapService } from './origin-map.service';

describe('OriginMapService', () => {
  let service: OriginMapService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ]
    });
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
  const reverseLookup = () => service.reverseLookup;
  const ref = (origin: string, local: string, remote = ''): Ref => ({
    url: 'spec:test',
    origin,
    plugins: { '+plugin/origin': { local, remote } },
  });
  it('reverseLookup on @other has named us @main', () => {
    setOrigins([
      ref('@other', '@main'),
    ]);
    setApi('spec:test');
    setLocal('');
    expect(reverseLookup().get('@other')).toEqual('@main');
  });
  it('reverseLookup on @other does not have an entry for our API', () => {
    setOrigins([
      ref('@other', '@main'),
    ]);
    setApi('spec:other');
    setLocal('');
    expect(reverseLookup().get('@other')).toBeFalsy();
  });
  it('reverseLookup on @other for tenant @mt has it named @main', () => {
    setOrigins([
      ref('@other', '@main', '@mt'),
    ]);
    setApi('spec:test');
    setLocal('@mt');
    expect(reverseLookup().get('@other')).toEqual('@main');
  });
  it('reverseLookup on @other does not have an entry for tenant @mt', () => {
    setOrigins([
      ref('@other', '@main', '@diff'),
    ]);
    setApi('spec:test');
    setLocal('@mt');
    expect(reverseLookup().get('@other')).toBeFalsy();
  });
});
