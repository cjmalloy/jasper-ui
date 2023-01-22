import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Ref } from '../model/ref';

import { OriginService } from './origin.service';

describe('OriginService', () => {
  let service: OriginService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ]
    });
    service = TestBed.inject(OriginService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
  // @ts-ignore
  const setOrigins = (origins: Ref[]) => service.origins = origins;
  // @ts-ignore
  const setApi = (api: string) => service.config.api = api;
  // @ts-ignore
  const setLocal = (origin: string) => service.store.account.tag = '+user' + origin;
  // @ts-ignore
  const reverseLookup = () => service.reverseLookup;
  const ref = (origin: string, target: string, source = ''): Ref => ({
    url: 'spec:test',
    origin,
    plugins: {'+plugin/origin': {
        origin: target,
        remote: source,
      }
    }
  });
  it('reverseLookup passed', () => {
    setOrigins([
      ref('@other', '@main'),
    ]);
    setApi('spec:test');
    setLocal('');
    expect(reverseLookup().get('@other')).toEqual('@main');
  });
  it('reverseLookup passed', () => {
    setOrigins([
      ref('@other', '@main'),
    ]);
    setApi('spec:test');
    setLocal('');
    expect(reverseLookup().get('@other')).toEqual('@main');
  });
  it('reverseLookup passed', () => {
    setOrigins([
      ref('@other', '@main'),
    ]);
    setApi('spec:other');
    setLocal('');
    expect(reverseLookup().get('@other')).toBeFalsy();
  });
  it('reverseLookup passed', () => {
    setOrigins([
      ref('@other', '@main', '@mt'),
    ]);
    setApi('spec:test');
    setLocal('@mt');
    expect(reverseLookup().get('@other')).toEqual('@main');
  });
  it('reverseLookup passed', () => {
    setOrigins([
      ref('@other', '@main', '@diff'),
    ]);
    setApi('spec:test');
    setLocal('@mt');
    expect(reverseLookup().get('@other')).toBeFalsy();
  });
});
