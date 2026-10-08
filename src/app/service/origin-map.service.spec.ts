/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Ref } from '../model/ref';
import { addressedTo, mapRemoteOrigin } from '../mods/mailbox';

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
  // @ts-ignore
  const setOrigins = (origins: Ref[]) => service.origins = origins;
  // @ts-ignore
  const setApi = (api: string) => service.config.api = api;
  // @ts-ignore
  const setLocal = (origin: string) => { service.store.account.origin = origin; service.store.origins.accountAliases = service.accountAliases; };
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
    describe('desktop pushing to @eggnog and pulling @city, with @city pulling @eggnog', () => {
      const pull = (url: string, origin: string, local: string, remote: string, proxy?: string): Ref => ({
        url,
        origin,
        tags: ['+plugin/origin/pull'],
        plugins: { '+plugin/origin': { local, remote, proxy } },
      });
      const push = (url: string, origin: string, local: string, remote: string, proxy?: string): Ref => ({
        url,
        origin,
        tags: ['+plugin/origin/push'],
        plugins: { '+plugin/origin': { local, remote, proxy } },
      });
      const desktopPullCity = pull('https://city.example', '', '@city', '@city', 'http://localhost:9001');
      const desktopPushEggnog = push('comment:eggnog', '', '', '@eggnog', 'http://localhost:9002');
      const cityPullEggnog = pull('comment:eggnog', '@city', '@eggnog', '@eggnog');

      it('maps eggnog sub-origins using our pushed configs', () => {
        setOrigins([desktopPullCity, desktopPushEggnog, cityPullEggnog]);
        setApi('http://localhost:8081');
        setLocal('');

        expect(originMap().get('@city.eggnog')?.get('@city')).toBe('@city');
      });

      it('maps city mirrored inside eggnog back to this origin', () => {
        setOrigins([desktopPullCity, desktopPushEggnog, cityPullEggnog]);
        setApi('http://localhost:8081');
        setLocal('');

        expect(originMap().get('@city.eggnog.city')?.get('@eggnog')).toBe('');
      });

      it('does not map when url matches but remote differs', () => {
        setOrigins([
          desktopPullCity,
          desktopPushEggnog,
          pull('comment:eggnog', '@city', '@eggnog', '@other'),
        ]);
        setApi('http://localhost:8081');
        setLocal('');

        expect(originMap().get('@city.eggnog')?.has('@city')).toBeFalsy();
      });

      it('does not map when remote matches but url differs', () => {
        setOrigins([
          desktopPullCity,
          desktopPushEggnog,
          pull('comment:other', '@city', '@eggnog', '@eggnog'),
        ]);
        setApi('http://localhost:8081');
        setLocal('');

        expect(originMap().get('@city.eggnog')?.has('@city')).toBeFalsy();
      });

      it('does not match origins by name', () => {
        setOrigins([
          desktopPullCity,
          cityPullEggnog,
          pull('https://elsewhere.example', '@city.eggnog', '@city', '@city'),
        ]);
        setApi('http://localhost:8081');
        setLocal('');

        expect(originMap().get('@city.eggnog')?.has('@city')).toBeFalsy();
      });

      it('maps transitively through a pull of a pull', () => {
        const desktopPullFoo = pull('https://foo.example', '', '@foo', '@foo');
        setOrigins([
          desktopPullCity,
          desktopPullFoo,
          desktopPushEggnog,
          cityPullEggnog,
          pull('https://bar.example', '@foo', '@bar', '@bar'),
          pull('https://bar.example', '', '@bar', '@bar'),
        ]);
        setApi('http://localhost:8081');
        setLocal('');

        // eggnog (our mirror) pulls foo into @eggnog.foo, which pulls bar
        expect(originMap().get('@city.eggnog.foo')?.get('@bar')).toBe('@bar');
      });

      it('displays recipients of a comment mirrored through eggnog', () => {
        setOrigins([desktopPullCity, desktopPushEggnog, cityPullEggnog]);
        setApi('http://localhost:8081');
        setLocal('');
        const tags = ['+user/bob', 'internal', 'plugin/comment', 'public', 'plugin/outbox/city/user/chris', 'plugin/inbox/user/chris'];
        const recipients = (ref: Ref) => addressedTo(ref)
          .map(t => mapRemoteOrigin(t, ref.origin || '', '', originMap().get(ref.origin || '')));

        expect(recipients({ url: 'comment:6cc', origin: '', tags })).toEqual(['+user/chris@city', '+user/chris']);
        expect(recipients({ url: 'comment:6cc', origin: '@city.eggnog', tags })).toEqual(['+user/chris@city', '+user/chris@city.eggnog']);
      });

      it('displays recipients on city when city declares its own url', () => {
        setOrigins([
          // City declares itself
          { url: 'https://city.example', origin: '@city', tags: [], plugins: { '+plugin/origin': { local: '', remote: '@city' } } },
          cityPullEggnog,
          // Desktop configs pushed to eggnog, pulled into city
          { ...desktopPullCity, origin: '@city.eggnog' },
          { ...desktopPushEggnog, origin: '@city.eggnog' },
        ]);
        setApi('http://localhost:8081');
        setLocal('@city');
        const tags = ['+user/bob', 'internal', 'plugin/comment', 'public', 'plugin/outbox/city/user/chris', 'plugin/inbox/user/chris'];
        const ref: Ref = { url: 'comment:6cc', origin: '@city.eggnog', tags };

        expect(addressedTo(ref).map(t => mapRemoteOrigin(t, ref.origin!, '@city', originMap().get(ref.origin!))))
          .toEqual(['+user/chris@city', '+user/chris@city.eggnog']);
      });

      it('displays recipients on city when the pulled url has a trailing slash', () => {
        setOrigins([
          cityPullEggnog,
          { ...desktopPullCity, url: 'https://city.example/', origin: '@city.eggnog' },
          { ...desktopPushEggnog, origin: '@city.eggnog' },
        ]);
        setApi('https://city.example');
        setLocal('@city');
        const ref: Ref = { url: 'comment:6cc', origin: '@city.eggnog', tags: ['plugin/outbox/city/user/chris'] };

        expect(addressedTo(ref).map(t => mapRemoteOrigin(t, ref.origin!, '@city', originMap().get(ref.origin!))))
          .toEqual(['+user/chris@city']);
      });

      it('works for a multi-tenant root origin', () => {
        setOrigins([
          pull('https://city.example', '@mt', '@city', '@city'),
          push('comment:eggnog', '@mt', '', '@eggnog'),
          pull('comment:eggnog', '@mt.city', '@eggnog', '@eggnog'),
        ]);
        setApi('http://localhost:8081');
        setLocal('@mt');

        expect(originMap().get('@mt.city.eggnog')?.get('@city')).toBe('@city');
      });
    });
    it('should map remote aliases for nested origins and this origin', () => {
      setOrigins([
        // Main -> City
        ref('spec:city', '', '@city'),
        // City -> Eggnog, replicated through City
        ref('spec:eggnog', '@city', '@eggnog'),
        // Eggnog -> City
        ref('spec:city', '@city.eggnog', '@city'),
        // Eggnog -> Main
        ref('spec:test', '@city.eggnog', '@main'),
      ]);
      setApi('spec:test');
      setLocal('');

      expect(originMap().get('@city.eggnog')?.get('@city')).toBe('@city');
      expect(originMap().get('@city.eggnog')?.get('@main')).toBe('');
      expect(originMap().get('@city.eggnog')?.has('@other')).toBe(false);
    });
  });

  describe('account aliases', () => {
    const aliasRef = (origin: string, local: string, author: string, aliases: string[], url = 'spec:remote'): Ref => ({
      url,
      origin,
      tags: ['+plugin/origin/pull', author],
      plugins: { '+plugin/origin': { local, remote: '', aliases } },
    });

    it('matches exact and descendant selectors while preserving suffixes', () => {
      setOrigins([aliasRef('', '@city', '+user/dad', ['+user/chris'])]);
      setLocal('');

      expect(service.aliasesFor('+user/dad')).toEqual(['+user/chris@city']);
      expect(service.aliasesFor('+user/dad/phone')).toEqual(['+user/chris/phone@city']);
    });

    it('only matches selectors on a slash boundary', () => {
      setOrigins([aliasRef('', '@city', '+user/qa', ['+user/tester'])]);
      setLocal('');

      expect(service.aliasesFor('+user/quality')).toEqual([]);
    });

    it('supports multiple aliases and deduplicates relationships', () => {
      setOrigins([
        aliasRef('', '@city', '+user/dad', ['+user/chris', '+user/cj', '+user/chris']),
        aliasRef('', '@city', '+user/dad', ['+user/chris']),
      ]);
      setLocal('');

      expect(service.aliasesFor('+user/dad')).toEqual([
        '+user/chris@city',
        '+user/cj@city',
      ]);
    });

    it('rejects a one-sided alias claim from a replicating remote', () => {
      setOrigins([
        aliasRef('@home', '@city', '+user/dad', ['+user/chris'], 'spec:test'),
      ]);
      setApi('spec:test');
      setLocal('');

      expect(service.aliasesFor('+user/chris')).toEqual([]);
      expect(service.isCurrentAccountRef({
        url: 'spec:post',
        origin: '@home',
        tags: ['+user/dad'],
      }, '+user/chris')).toBeFalsy();
    });

    it('accepts links between remotes declared on both sides', () => {
      setOrigins([
        aliasRef('', '@b', '+user/me', [], 'spec:b'),
        aliasRef('', '@c', '+user/me', [], 'spec:c'),
        aliasRef('@b', '@c', '+user/yukie', ['+user/yukie'], 'spec:c'),
        aliasRef('@c', '@b', '+user/yukie', ['+user/yukie'], 'spec:b'),
      ]);
      setApi('spec:test');
      setLocal('');

      expect(service.aliasesFor('+user/yukie@b')).toEqual(['+user/yukie@c']);
      expect(service.aliasesFor('+user/yukie/phone@c')).toEqual(['+user/yukie/phone@b']);
      expect(service.aliasesFor('+user/yukie')).toEqual([]);
    });

    it('accepts links with a nested sub-origin declared on both sides', () => {
      setOrigins([
        aliasRef('', '@b', '+user/me', [], 'spec:b'),
        aliasRef('@b', '@c', '+user/yukie', ['+user/yukie'], 'spec:c'),
        aliasRef('@b.c', '@b', '+user/yukie', ['+user/yukie'], 'spec:b'),
      ]);
      setApi('spec:test');
      setLocal('');

      expect(service.aliasesFor('+user/yukie@b')).toEqual(['+user/yukie@b.c']);
      expect(service.aliasesFor('+user/yukie@b.c')).toEqual(['+user/yukie@b']);
    });

    it('rejects links between remotes declared on only one side', () => {
      setOrigins([
        aliasRef('', '@b', '+user/me', [], 'spec:b'),
        aliasRef('', '@c', '+user/me', [], 'spec:c'),
        aliasRef('@b', '@c', '+user/yukie', ['+user/yukie'], 'spec:c'),
        aliasRef('@c', '@b', '+user/yukie', ['+user/other'], 'spec:b'),
      ]);
      setApi('spec:test');
      setLocal('');

      expect(service.aliasesFor('+user/yukie@b')).toEqual([]);
      expect(service.aliasesFor('+user/yukie@c')).toEqual([]);
    });

    it('ignores remote claims on local accounts that conflict with local declarations', () => {
      setOrigins([
        aliasRef('', '@home', '+user/chris', ['+user/bob'], 'spec:home'),
        aliasRef('@home', '@city', '+user/dad', ['+user/chris'], 'spec:test'),
      ]);
      setApi('spec:test');
      setLocal('');

      expect(service.aliasesFor('+user/chris')).toEqual(['+user/bob@home']);
      expect(service.isCurrentAccountRef({
        url: 'spec:post',
        origin: '@home',
        tags: ['+user/dad'],
      }, '+user/chris')).toBeFalsy();
      expect(service.isCurrentAccountRef({
        url: 'spec:post',
        origin: '@home',
        tags: ['+user/bob'],
      }, '+user/chris')).toBeTruthy();
    });

    it('checks authors using hierarchical aliases', () => {
      setOrigins([aliasRef('', '@city', '+user/dad', ['+user/chris'])]);
      setLocal('');

      expect(service.isCurrentAccountRef({
        url: 'spec:post',
        origin: '@city',
        tags: ['+user/chris/phone'],
      }, '+user/dad')).toBeTruthy();
      expect(service.isCurrentAccountRef({
        url: 'spec:post',
        origin: '@city',
        tags: ['+user/christopher'],
      }, '+user/dad')).toBeFalsy();
    });

    it('does not chain links transitively', () => {
      setOrigins([
        aliasRef('', '@b', '+user/me', [], 'spec:b'),
        aliasRef('', '@c', '+user/me', [], 'spec:c'),
        aliasRef('', '@d', '+user/me', [], 'spec:d'),
        aliasRef('@b', '@c', '+user/yukie', ['+user/yukie'], 'spec:c'),
        aliasRef('@c', '@b', '+user/yukie', ['+user/yukie'], 'spec:b'),
        aliasRef('@c', '@d', '+user/yukie', ['+user/yukie'], 'spec:d'),
        aliasRef('@d', '@c', '+user/yukie', ['+user/yukie'], 'spec:c'),
      ]);
      setApi('spec:test');
      setLocal('');

      expect(service.aliasesFor('+user/yukie@b')).toEqual(['+user/yukie@c']);
      expect(service.aliasesFor('+user/yukie@c')).toEqual(['+user/yukie@b', '+user/yukie@d']);
      expect(service.aliasesFor('+user/yukie@d')).toEqual(['+user/yukie@c']);
    });

    it('resolves remote targets by url ignoring a trailing slash', () => {
      setOrigins([
        aliasRef('', '@b', '+user/me', [], 'spec:b/'),
        aliasRef('', '@c', '+user/me', [], 'spec:c'),
        aliasRef('@b', '@x', '+user/yukie', ['+user/yukie'], 'spec:c/'),
        aliasRef('@c', '@y', '+user/yukie', ['+user/yukie'], 'spec:b'),
      ]);
      setApi('spec:test');
      setLocal('');

      expect(service.aliasesFor('+user/yukie@b')).toEqual(['+user/yukie@c']);
      expect(service.aliasesFor('+user/yukie@c')).toEqual(['+user/yukie@b']);
    });

    it('only trusts the local declaration when a replicating remote declares the same link', () => {
      setOrigins([
        aliasRef('', '@home', '+user/chris', ['+user/bob'], 'spec:home'),
        aliasRef('@home', '@main', '+user/bob', ['+user/chris'], 'spec:test'),
      ]);
      setApi('spec:test');
      setLocal('');

      expect(service.aliasesFor('+user/chris')).toEqual(['+user/bob@home']);
      expect(service.aliasesFor('+user/bob@home')).toEqual([]);
    });

    it('ignores aliases on push-only origin Refs', () => {
      setOrigins([{
        url: 'spec:eggnog',
        origin: '',
        tags: ['+plugin/origin/push', '+user/alice'],
        plugins: { '+plugin/origin': { local: '', remote: '@eggnog', aliases: ['+user/bob'] } },
      }]);
      setLocal('');

      expect(service.aliasesFor('+user/alice')).toEqual([]);
      expect(service.isCurrentAccountRef({
        url: 'spec:post',
        tags: ['+user/bob'],
      }, '+user/alice')).toBeFalsy();
    });

    it('treats a Ref without an origin as local', () => {
      setOrigins([aliasRef('', '@city', '+user/dad', ['+user/chris'])]);
      setLocal('');

      expect(service.isCurrentAccountRef({
        url: 'spec:post',
        tags: ['+user/dad'],
      }, '+user/dad')).toBeTruthy();
      expect(service.isCurrentAccountRef({
        url: 'spec:post',
        tags: ['+user/chris'],
      }, '+user/dad')).toBeFalsy();
    });
  });

});
