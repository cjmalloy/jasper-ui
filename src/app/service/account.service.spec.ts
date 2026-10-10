/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DateTime } from 'luxon';
import { catchError, EMPTY, of, Subject, throwError } from 'rxjs';
import { Page } from '../model/page';
import { Ref } from '../model/ref';

import { AccountService, compareCursors } from './account.service';

describe('AccountService', () => {
  let service: AccountService;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    service = TestBed.inject(AccountService);
    http = TestBed.inject(HttpTestingController);
    vi.spyOn((service as any).admin, 'getPlugin').mockImplementation((tag: any) =>
      tag === 'plugin/user/cursor' ? { tag } : undefined);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  const setAccount = () => {
    const store = (service as any).store;
    store.account.tag = '+user/dad';
    store.account.origin = '';
    store.account.ext = {
      tag: '+user/dad',
      origin: '',
      config: {},
    };
  };
  const setOrigins = (refs: Ref[]) => {
    const origins = (service as any).origins;
    origins.origins = refs;
    (service as any).store.origins.accountAliases = origins.accountAliases;
  };

  const inbox = 'plugin/inbox/user/dad';
  const expectSavedCursors = (content: Ref[] = [], account = '+user/dad@') =>
    http.expectOne(req =>
      req.method === 'GET' &&
      req.url.endsWith('/api/v1/ref/page') &&
      req.params.get('query') === 'plugin/user/cursor:' + account).flush(Page.of(content));

  it('does not create a cursor when none is saved', () => {
    setAccount();
    const store = (service as any).store;
    service.loadNotificationCursors$().subscribe();
    expectSavedCursors();
    http.expectOne(req =>
      req.method === 'GET' &&
      req.url.endsWith('/api/v1/tags/response') &&
      req.params.get('url') === 'tag:/plugin/inbox').flush({}, { status: 404, statusText: 'Not Found' });
    http.expectNone(req => req.method === 'PATCH');

    expect(store.account.notificationCursors.has('')).toBe(false);
    service.loadNotificationCursors$().subscribe();
    http.expectNone(() => true);
  });

  it('creates one stream per origin, not per alias', () => {
    setAccount();
    setOrigins([
      {
        url: 'spec:city',
        origin: '',
        tags: ['+plugin/origin/pull', '+user/dad'],
        plugins: { '+plugin/origin': {
          local: '@city',
          aliases: ['+user/chris', '+user/cj', '+user/chris'],
        } },
      },
      {
        url: 'spec:town',
        origin: '',
        tags: ['+plugin/origin/pull', '+user/dad'],
        plugins: { '+plugin/origin': {
          local: '@town',
          aliases: ['+user/dad'],
        } },
      },
    ]);

    const streams = service.notificationStreams;
    expect(streams.filter(stream => stream.origin === '@city')).toHaveLength(1);
    expect(streams.find(stream => stream.origin === '@city')?.query).toContain('user/chris');
    expect(streams.find(stream => stream.origin === '@city')?.query).toContain('user/cj');
    expect(streams.find(stream => stream.origin === '@city')?.settingsUrl).toEqual('tag:/plugin/outbox/city');
    expect(streams.find(stream => stream.origin === '@town')?.settingsUrl).toEqual('tag:/plugin/outbox/town');
  });

  it('only creates streams for other origins with a loaded cursor', () => {
    setAccount();
    const store = (service as any).store;
    store.account.ext.config.alarms = ['alarm'];
    store.origins.list = ['', '@city', '@town'];
    store.account.notificationCursors.set('@city', '2026-01-01T00:00:00.000Z');

    const streams = service.notificationStreams;

    expect(streams.find(stream => stream.origin === '@town')).toBeUndefined();
    expect(streams.find(stream => stream.origin === '@city')?.query).toEqual(`@city:!+user/dad:!plugin/delete:(${inbox}|alarm)`);
    expect(streams.find(stream => stream.origin === '@city')?.alarmQuery).toEqual('@city:!+user/dad:!plugin/delete:(alarm)');
    expect(streams.find(stream => stream.origin === '@city')?.settingsUrl).toEqual('tag:/plugin/outbox/city');
  });

  describe('notifications from other origins', () => {
    const localCursor = '2026-01-01T00:00:00.000Z';

    beforeEach(() => {
      setAccount();
      const store = (service as any).store;
      store.account.ext.config.alarms = ['alarm'];
      store.origins.list = ['', '@city', '@town'];
      (service as any).cursorAccount = store.account.tagWithOrigin;
      (service as any).savedCursors = of(undefined);
      store.account.notificationCursors.set('', localCursor);
      vi.spyOn((service as any).admin, 'getTemplate').mockReturnValue({ tag: 'user' });
    });

    it('counts all notifications from origins without a stream without writing cursors', () => {
      const store = (service as any).store;
      service.checkNotifications();
      const counts = http.match(req => req.method === 'GET' && req.url.endsWith('/api/v1/ref/count'));
      const other = counts.find(req => req.request.params.get('query') === `!+user/dad:!plugin/delete:!@:(${inbox}|alarm)`)!;
      const otherAlarms = counts.find(req => req.request.params.get('query') === '!+user/dad:!plugin/delete:!@:(alarm)')!;
      expect(other.request.params.has('modifiedAfter')).toBe(false);
      expect(otherAlarms.request.params.has('modifiedAfter')).toBe(false);
      for (const req of counts) req.flush(req === other ? 3 : req === otherAlarms ? 2 : 0);

      expect(store.account.notifications).toBe(3);
      expect(store.account.alarmCount).toBe(2);
      expect(Array.from(store.account.notificationCursors.keys())).toEqual(['']);
    });

    it('counts notifications from origins without a stream when there are no alarms', () => {
      const store = (service as any).store;
      store.account.ext.config.alarms = [];
      service.checkNotifications();
      const counts = http.match(req => req.method === 'GET' && req.url.endsWith('/api/v1/ref/count'));
      expect(counts.map(req => req.request.params.get('query'))).toEqual([
        `@:!+user/dad:!plugin/delete:(${inbox}@)`,
        `!+user/dad:!plugin/delete:!@:(${inbox})`,
      ]);
      for (const req of counts) req.flush(1);

      expect(store.account.notifications).toBe(2);
      expect(store.account.alarmCount).toBe(0);
    });

    it('creates the cursor for an alarm origin when it is cleared', async () => {
      const readDate = DateTime.fromISO('2026-02-01T00:00:00.000Z');
      const cursor = readDate.plus({ millisecond: 1 }).toISO();
      vi.spyOn(service, 'checkNotifications').mockImplementation(() => {});
      const cleared = service.clearNotifications(readDate, ['@city']);
      http.expectOne(req =>
        req.method === 'GET' &&
        req.url.endsWith('/api/v1/tags/response') &&
        req.params.get('url') === 'tag:/plugin/outbox/city').flush({}, { status: 404, statusText: 'Not Found' });
      const create = http.expectOne(req =>
        req.method === 'PATCH' &&
        req.url.endsWith('/api/v1/tags/response') &&
        req.params.get('url') === 'tag:/plugin/outbox/city');
      expect(create.request.body['plugin/user/cursor'].cursor).toEqual(cursor);
      create.flush(null);
      http.expectOne(req =>
        req.method === 'GET' &&
        req.url.endsWith('/api/v1/tags/response') &&
        req.params.get('url') === 'tag:/plugin/outbox/city').flush({
        url: 'tag:/+user/dad?url=tag:/plugin/outbox/city',
        origin: '',
        plugins: { 'plugin/user/cursor': { cursor } },
        modified: cursor,
      });
      await cleared;

      expect((service as any).store.account.notificationCursors.get('@city')).toEqual(cursor);
      expect(service.notificationStreams.map(stream => stream.origin)).toEqual(['', '@city']);
    });

    it('creates cursors for multiple alarm origins cleared together', async () => {
      const readDate = DateTime.fromISO('2026-02-01T00:00:00.000Z');
      vi.spyOn(service, 'checkNotifications').mockImplementation(() => {});
      const cleared = Promise.all([
        service.clearNotifications(readDate, ['@city']),
        service.clearNotifications(readDate, ['@town']),
      ]);
      for (const origin of ['city', 'town']) {
        const url = 'tag:/plugin/outbox/' + origin;
        http.expectOne(req => req.method === 'GET' && req.params.get('url') === url)
          .flush({}, { status: 404, statusText: 'Not Found' });
        http.expectOne(req => req.method === 'PATCH' && req.params.get('url') === url).flush(null);
        http.expectOne(req => req.method === 'GET' && req.params.get('url') === url).flush({
          url: 'tag:/+user/dad?url=' + url,
          origin: '',
          plugins: { 'plugin/user/cursor': { cursor: readDate.plus({ millisecond: 1 }).toISO() } },
        });
      }
      await cleared;

      const cursors = (service as any).store.account.notificationCursors;
      expect(cursors.has('@city')).toBe(true);
      expect(cursors.has('@town')).toBe(true);
    });
    it('counts and clears an origin without a stream', () => {
      const readDate = DateTime.fromISO('2026-02-01T00:00:00.000Z');
      const count = vi.spyOn((service as any).refs, 'count').mockReturnValue(of(0));
      const clear = vi.spyOn(service, 'clearNotifications').mockImplementation(() => Promise.resolve());

      service.clearNotificationsIfNone(readDate, '@city');

      expect(count).toHaveBeenCalledWith(expect.objectContaining({
        query: `@city:!+user/dad:!plugin/delete:(${inbox}|alarm)`,
        modifiedAfter: undefined,
        modifiedBefore: readDate,
      }));
      expect(clear).toHaveBeenCalledWith(readDate, ['@city']);
    });

    it('discovers other origins before clearing all origins', async () => {
      const readDate = DateTime.fromISO('2026-02-01T00:00:00.000Z');
      const cursor = readDate.plus({ millisecond: 1 }).toISO();
      vi.spyOn(service, 'checkNotifications').mockImplementation(() => {});
      const page = vi.spyOn((service as any).refs, 'page')
        .mockReturnValueOnce(of(Page.of([{ url: 'spec:a', origin: '@city' }])))
        .mockReturnValueOnce(of(Page.of([])));
      const cleared = service.clearNotifications(readDate);
      expect(page).toHaveBeenNthCalledWith(1, expect.objectContaining({ query: `!+user/dad:!plugin/delete:!@:(${inbox}|alarm)` }));
      expect(page.mock.calls[0][0]).not.toHaveProperty('modifiedAfter');
      http.expectOne(req => req.method === 'GET' && req.params.get('url') === 'tag:/plugin/outbox/city')
        .flush({}, { status: 404, statusText: 'Not Found' });
      const create = http.expectOne(req => req.method === 'PATCH' && req.params.get('url') === 'tag:/plugin/outbox/city');
      expect(create.request.body['plugin/user/cursor'].cursor).toEqual(cursor);
      create.flush(null);
      http.expectOne(req => req.method === 'GET' && req.params.get('url') === 'tag:/plugin/outbox/city').flush({
        url: 'tag:/+user/dad?url=tag:/plugin/outbox/city',
        origin: '',
        plugins: { 'plugin/user/cursor': { cursor } },
      });
      expect(page).toHaveBeenNthCalledWith(2, expect.objectContaining({ query: `!+user/dad:!plugin/delete:!@:!@city:(${inbox}|alarm)` }));
      http.expectOne(req => req.method === 'PATCH' && req.params.get('url') === 'tag:/plugin/inbox').flush(null);
      http.expectOne(req => req.method === 'GET' && req.params.get('url') === 'tag:/plugin/inbox').flush({
        url: 'tag:/+user/dad?url=tag:/plugin/inbox',
        origin: '',
        plugins: { 'plugin/user/cursor': { cursor } },
      });
      await cleared;

      expect((service as any).store.account.notificationCursors.get('@city')).toEqual(cursor);
      expect((service as any).store.account.notificationCursors.get('')).toEqual(cursor);
    });

    it('keeps other origins unread when only the local origin is cleared', async () => {
      const readDate = DateTime.fromISO('2026-02-01T00:00:00.000Z');
      const cursor = readDate.plus({ millisecond: 1 }).toISO();
      vi.spyOn(service, 'checkNotifications').mockImplementation(() => {});
      const page = vi.spyOn((service as any).refs, 'page');
      const cleared = service.clearNotifications(readDate, ['']);
      http.expectOne(req => req.method === 'PATCH' && req.params.get('url') === 'tag:/plugin/inbox').flush(null);
      http.expectOne(req => req.method === 'GET' && req.params.get('url') === 'tag:/plugin/inbox').flush({
        url: 'tag:/+user/dad?url=tag:/plugin/inbox',
        origin: '',
        plugins: { 'plugin/user/cursor': { cursor } },
      });
      await cleared;

      expect(page).not.toHaveBeenCalled();
      expect((service as any).store.account.notificationCursors.has('@city')).toBe(false);
      expect((service as any).store.account.notificationCursors.get('')).toEqual(cursor);
    });
  });

  it('compares cursors with sub-millisecond precision', () => {
    expect(compareCursors('2026-01-01T00:00:00.0001Z', '2026-01-01T00:00:00.0002Z')).toBeLessThan(0);
    expect(compareCursors('2026-01-01T00:00:00.000200Z', '2026-01-01T00:00:00.0002Z')).toBe(0);
    expect(compareCursors('2026-01-01T00:00:00Z', '2026-01-01T00:00:00.5Z')).toBeLessThan(0);
    expect(compareCursors('2026-01-01T01:00:00.001+01:00', '2026-01-01T00:00:00.000900Z')).toBeGreaterThan(0);
  });

  it('writes exact cursors without rounding', async () => {
    setAccount();
    const store = (service as any).store;
    (service as any).cursorAccount = store.account.tagWithOrigin;
    (service as any).savedCursors = of(undefined);
    store.account.notificationCursors.set('', '2026-01-01T00:00:00.000100Z');
    vi.spyOn((service as any).admin, 'getTemplate').mockReturnValue({ tag: 'user' });
    vi.spyOn(service, 'checkNotifications').mockImplementation(() => {});
    const cleared = service.clearNotifications('2026-01-01T00:00:00.000200Z', ['']);
    const create = http.expectOne(req => req.method === 'PATCH' && req.params.get('url') === 'tag:/plugin/inbox');
    expect(create.request.body['plugin/user/cursor'].cursor).toEqual('2026-01-01T00:00:00.000200Z');
    create.flush(null);
    http.expectOne(req => req.method === 'GET' && req.params.get('url') === 'tag:/plugin/inbox').flush({
      url: 'tag:/+user/dad?url=tag:/plugin/inbox',
      origin: '',
      plugins: { 'plugin/user/cursor': { cursor: '2026-01-01T00:00:00.000200Z' } },
    });
    await cleared;

    expect(store.account.notificationCursors.get('')).toEqual('2026-01-01T00:00:00.000200Z');
  });

  it('keeps cursors in memory when the cursor plugin is not installed', async () => {
    setAccount();
    const store = (service as any).store;
    vi.spyOn((service as any).admin, 'getPlugin').mockReturnValue(undefined);
    vi.spyOn((service as any).admin, 'getTemplate').mockReturnValue({ tag: 'user' });
    vi.spyOn(service, 'checkNotifications').mockImplementation(() => {});

    service.loadNotificationCursors$().subscribe();
    expect(store.account.notificationCursors.has('')).toBe(false);

    await service.clearNotifications('2099-01-01T00:00:00.000Z', ['']);
    expect(store.account.notificationCursors.get('')).toEqual('2099-01-01T00:00:00.000Z');
    http.expectNone(() => true);
  });

  it('loads independent cursors for multiple origins', () => {
    setAccount();
    setOrigins([
      {
        url: 'spec:city',
        origin: '',
        tags: ['+plugin/origin/pull', '+user/dad'],
        plugins: { '+plugin/origin': { local: '@city', aliases: ['+user/chris', '+user/cj'] } },
      },
      {
        url: 'spec:town',
        origin: '',
        tags: ['+plugin/origin/pull', '+user/dad'],
        plugins: { '+plugin/origin': { local: '@town', aliases: ['+user/dad'] } },
      },
    ]);

    service.loadNotificationCursors$().subscribe();
    expectSavedCursors();
    const cursors = new Map([
      ['tag:/plugin/inbox', '2026-01-01T00:00:00.000Z'],
      ['tag:/plugin/outbox/city', '2026-02-01T00:00:00.000Z'],
      ['tag:/plugin/outbox/town', '2026-03-01T00:00:00.000Z'],
    ]);
    for (const [url, cursor] of cursors) {
      const request = http.expectOne(req =>
        req.method === 'GET' &&
        req.url.endsWith('/api/v1/tags/response') &&
        req.params.get('url') === url);
      request.flush({
        url: `tag:/+user/dad?url=${url}`,
        origin: '',
        plugins: { 'plugin/user/cursor': { cursor } },
        modified: cursor,
      });
    }

    expect(Array.from((service as any).store.account.notificationCursors)).toEqual([
      ['', '2026-01-01T00:00:00.000Z'],
      ['@city', '2026-02-01T00:00:00.000Z'],
      ['@town', '2026-03-01T00:00:00.000Z'],
    ]);
  });

  it('only clears notifications for the read origin', () => {
    setAccount();
    const streams = [
      { origin: '@city', query: '@city:inbox', settingsUrl: 'tag:/plugin/outbox/city' },
      { origin: '@town', query: '@town:inbox', settingsUrl: 'tag:/plugin/outbox/town' },
    ];
    vi.spyOn((service as any).admin, 'getTemplate').mockReturnValue({});
    vi.spyOn(service, 'loadNotificationCursors$').mockReturnValue(of(streams));
    const count = vi.spyOn((service as any).refs, 'count').mockReturnValue(of(0));
    const clear = vi.spyOn(service, 'clearNotifications').mockImplementation(() => Promise.resolve());
    const readDate = DateTime.fromISO('2026-04-01T00:00:00.000Z');

    service.clearNotificationsIfNone(readDate, '@city');

    expect(count).toHaveBeenCalledOnce();
    expect(count).toHaveBeenCalledWith(expect.objectContaining({ query: '@city:inbox' }));
    expect(clear).toHaveBeenCalledWith(readDate, ['@city']);
  });

  it('clears the local stream when the read origin is undefined', () => {
    setAccount();
    const streams = [
      { origin: '', query: '@:inbox', settingsUrl: 'tag:/plugin/inbox' },
      { origin: '@city', query: '@city:inbox', settingsUrl: 'tag:/plugin/outbox/city' },
    ];
    vi.spyOn((service as any).admin, 'getTemplate').mockReturnValue({});
    vi.spyOn(service, 'loadNotificationCursors$').mockReturnValue(of(streams));
    const count = vi.spyOn((service as any).refs, 'count').mockReturnValue(of(0));
    const clear = vi.spyOn(service, 'clearNotifications').mockImplementation(() => Promise.resolve());
    const readDate = DateTime.fromISO('2026-04-01T00:00:00.000Z');

    service.clearNotificationsIfNone(readDate, undefined);

    expect(count).toHaveBeenCalledOnce();
    expect(count).toHaveBeenCalledWith(expect.objectContaining({ query: '@:inbox' }));
    expect(clear).toHaveBeenCalledWith(readDate, ['']);
  });

  describe('checkNotifications', () => {
    const streams = [
      { origin: '', query: '@:inbox', alarmQuery: '@:(science)', settingsUrl: 'tag:/plugin/inbox' },
      { origin: '@city', query: '@city:inbox', alarmQuery: '@city:(science)', settingsUrl: 'tag:/plugin/outbox/city' },
    ];
    let count: any;
    let load: any;

    beforeEach(() => {
      setAccount();
      (service as any).store.account.ext.config.alarms = ['science'];
      vi.spyOn((service as any).admin, 'getTemplate').mockReturnValue({ tag: 'user' });
      load = vi.spyOn(service, 'loadNotificationCursors$').mockReturnValue(of(streams));
      vi.spyOn((service as any).refs, 'page').mockReturnValue(of(Page.of([])));
      count = vi.spyOn((service as any).refs, 'count');
    });

    it('updates notifications and alarm counts together', () => {
      const store = (service as any).store;
      count.mockImplementation((args: any) => of(args.query.startsWith('!') ? 0 : args.query.endsWith(':(science)') ? 1 : 3));
      service.checkNotifications();
      expect(store.account.notifications).toBe(6);
      expect(store.account.alarmCount).toBe(2);
      expect(store.account.unreadCount).toBe(4);
    });

    it('cancels superseded notification checks', () => {
      const store = (service as any).store;
      const stale = new Subject<number>();
      count.mockReturnValueOnce(stale).mockReturnValue(of(1));
      service.checkNotifications();
      service.checkNotifications();
      stale.next(9);
      stale.complete();
      expect(store.account.notifications).toBe(3);
    });

    it('resets alarm count when alarms are removed', () => {
      const store = (service as any).store;
      count.mockImplementation((args: any) => of(args.query.startsWith('!') ? 0 : args.query.endsWith(':(science)') ? 1 : 3));
      service.checkNotifications();
      store.account.ext = { tag: '+user/dad', origin: '', config: { alarms: [] } };
      load.mockReturnValue(of(streams.map(({ alarmQuery, ...stream }) => stream)));
      count.mockReturnValue(of(2));
      service.checkNotifications();
      expect(count).toHaveBeenCalledTimes(9);
      expect(store.account.notifications).toBe(6);
      expect(store.account.alarmCount).toBe(0);
      expect(store.account.unreadCount).toBe(6);
    });
  });

  it('merges notification pages from all streams', () => {
    setAccount();
    const store = (service as any).store;
    store.account.ext.config.alarms = ['alarm'];
    store.account.notificationCursors.set('', '2026-01-01T00:00:00.000Z');
    store.account.notificationCursors.set('@city', '2026-02-01T00:00:00.000Z');
    vi.spyOn(service, 'loadNotificationCursors$').mockReturnValue(of([
      { origin: '', query: '@:inbox', settingsUrl: 'tag:/plugin/inbox' },
      { origin: '@city', query: '@city:inbox', settingsUrl: 'tag:/plugin/outbox/city' },
    ]));
    const ref = (url: string, origin: string, modified: string): Ref =>
      ({ url, origin, modified: DateTime.fromISO(modified) });
    const pageOf = (total: number, ...refs: Ref[]) => {
      const page = Page.of(refs);
      page.page.totalElements = total;
      return page;
    };
    const pages: Record<string, Page<Ref>> = {
      '@:inbox': pageOf(4, ref('spec:local1', '', '2026-03-01T00:00:00.000Z'), ref('spec:local2', '', '2026-03-04T00:00:00.000Z')),
      '@city:inbox': pageOf(2, ref('spec:city1', '@city', '2026-03-02T00:00:00.000Z'), ref('spec:city2', '@city', '2026-03-05T00:00:00.000Z')),
      [`!+user/dad:!plugin/delete:!@:!@city:(${inbox}|alarm)`]: pageOf(1, ref('spec:town1', '@town', '2026-03-03T00:00:00.000Z')),
    };
    const page = vi.spyOn((service as any).refs, 'page').mockImplementation((args: any) => of(pages[args.query]));

    let result: Page<Ref> | undefined;
    service.notificationPage$(3).subscribe(p => result = p);

    expect(result!.content.map(ref => ref.url)).toEqual(['spec:local1', 'spec:city1', 'spec:town1']);
    expect(result!.page.totalElements).toBe(7);
    expect(result!.page.totalPages).toBe(3);
    expect(result!.page.size).toBe(3);
    expect(page).toHaveBeenCalledTimes(3);
    expect(page).toHaveBeenCalledWith(expect.objectContaining({ query: '@:inbox', modifiedAfter: '2026-01-01T00:00:00.000Z', size: 3 }));
    expect(page).toHaveBeenCalledWith(expect.objectContaining({ query: '@city:inbox', modifiedAfter: '2026-02-01T00:00:00.000Z', size: 3 }));
    expect(page).toHaveBeenCalledWith(expect.objectContaining({ query: `!+user/dad:!plugin/delete:!@:!@city:(${inbox}|alarm)`, modifiedAfter: undefined, size: 3 }));
  });

  describe('writing cursors', () => {
    const oldCursor = '2026-01-01T00:00:00.000Z';
    const readDate = DateTime.fromISO('2026-02-01T00:00:00.000Z');
    const cursor = readDate.plus({ millisecond: 1 }).toISO()!;
    const cityUrl = 'tag:/+user/dad?url=tag:/plugin/outbox/city';
    const cursorRef = (cursor: string, modifiedString: string): Ref => ({
      url: cityUrl,
      origin: '',
      plugins: { 'plugin/user/cursor': { cursor } },
      modifiedString,
    });
    let patch: any;

    beforeEach(() => {
      setAccount();
      setOrigins([{
        url: 'spec:city',
        origin: '',
        tags: ['+plugin/origin/pull', '+user/dad'],
        plugins: { '+plugin/origin': { local: '@city', aliases: ['+user/chris'] } },
      }]);
      const store = (service as any).store;
      (service as any).cursorAccount = store.account.tagWithOrigin;
      (service as any).savedCursors = of(undefined);
      store.account.notificationCursors.set('', oldCursor);
      store.account.notificationCursors.set('@city', oldCursor);
      (service as any).cursorRefs.set('@city', cursorRef(oldCursor, 'm1'));
      vi.spyOn((service as any).admin, 'getTemplate').mockReturnValue({ tag: 'user' });
      vi.spyOn(service, 'checkNotifications').mockImplementation(() => {});
      patch = vi.spyOn((service as any).refs, 'patch');
    });

    it('patches an existing cursor and keeps the new modified cursor', async () => {
      patch.mockReturnValueOnce(of('m2')).mockReturnValueOnce(of('m3'));

      await service.clearNotifications(readDate, ['@city']);

      expect(patch).toHaveBeenCalledWith(cityUrl, '', 'm1', [{
        op: 'add',
        path: '/plugins/plugin~1user~1cursor/cursor',
        value: cursor,
      }]);
      expect((service as any).cursorRefs.get('@city').modifiedString).toEqual('m2');
      expect((service as any).store.account.notificationCursors.get('@city')).toEqual(cursor);

      const later = readDate.plus({ day: 1 });
      await service.clearNotifications(later, ['@city']);
      expect(patch).toHaveBeenLastCalledWith(cityUrl, '', 'm2', expect.anything());
      expect((service as any).cursorRefs.get('@city').modifiedString).toEqual('m3');
    });

    it('merges the cursor plugin into an existing settings Ref without plugins', async () => {
      (service as any).cursorRefs.set('@city', { url: cityUrl, origin: '', modifiedString: 'm1' });
      const patchResponse = vi.spyOn((service as any).tags, 'patchResponse');
      const merge = vi.spyOn((service as any).tags, 'mergeResponse').mockReturnValue(of(undefined));
      vi.spyOn((service as any).tags, 'getResponse').mockReturnValue(of(cursorRef(cursor, 'm2')));

      await service.clearNotifications(readDate, ['@city']);

      expect(patch).not.toHaveBeenCalled();
      expect(patchResponse).not.toHaveBeenCalled();
      expect(merge).toHaveBeenCalledWith(['plugin/user/cursor'], 'tag:/plugin/outbox/city', {
        'plugin/user/cursor': { cursor },
      });
      expect((service as any).cursorRefs.get('@city').modifiedString).toEqual('m2');
      expect((service as any).store.account.notificationCursors.get('@city')).toEqual(cursor);
    });

    it('patches the cursor through the tag response when the Ref has no modified cursor', async () => {
      (service as any).cursorRefs.set('@city', { url: cityUrl, origin: '', plugins: { 'plugin/user/cursor': { cursor: oldCursor } } });
      const patchResponse = vi.spyOn((service as any).tags, 'patchResponse').mockReturnValue(of(undefined));

      await service.clearNotifications(readDate, ['@city']);

      expect(patch).not.toHaveBeenCalled();
      expect(patchResponse).toHaveBeenCalledWith(['plugin/user/cursor'], 'tag:/plugin/outbox/city', [{
        op: 'add',
        path: '/plugins/plugin~1user~1cursor/cursor',
        value: cursor,
      }]);
      expect((service as any).store.account.notificationCursors.get('@city')).toEqual(cursor);
    });

    it('refetches the cursor Ref and retries once on a write conflict', async () => {
      patch
        .mockReturnValueOnce(throwError(() => ({ status: 409 })))
        .mockReturnValueOnce(of('m3'));
      const get = vi.spyOn((service as any).tags, 'getResponse').mockReturnValue(of(cursorRef(oldCursor, 'm2')));

      await service.clearNotifications(readDate, ['@city']);

      expect(get).toHaveBeenCalledWith('tag:/plugin/outbox/city');
      expect(patch).toHaveBeenCalledTimes(2);
      expect(patch).toHaveBeenLastCalledWith(cityUrl, '', 'm2', expect.anything());
      expect((service as any).cursorRefs.get('@city').modifiedString).toEqual('m3');
      expect((service as any).store.account.notificationCursors.get('@city')).toEqual(cursor);
    });

    it('keeps a newer cursor written elsewhere after a write conflict', async () => {
      const newer = '2026-03-01T00:00:00.000Z';
      patch.mockReturnValueOnce(throwError(() => ({ status: 409 })));
      vi.spyOn((service as any).tags, 'getResponse').mockReturnValue(of(cursorRef(newer, 'm2')));

      await service.clearNotifications(readDate, ['@city']);

      expect(patch).toHaveBeenCalledOnce();
      expect((service as any).cursorRefs.get('@city').modifiedString).toEqual('m2');
      expect((service as any).store.account.notificationCursors.get('@city')).toEqual(newer);
    });

    it('rejects and keeps the old cursor when the retry also conflicts', async () => {
      patch.mockReturnValue(throwError(() => ({ status: 409 })));
      vi.spyOn((service as any).tags, 'getResponse').mockReturnValue(of(cursorRef(oldCursor, 'm2')));

      await expect(service.clearNotifications(readDate, ['@city'])).rejects.toEqual({ status: 409 });

      expect(patch).toHaveBeenCalledTimes(2);
      expect((service as any).store.account.notificationCursors.get('@city')).toEqual(oldCursor);
    });

    it('never moves a cursor backwards', async () => {
      const newer = '2026-03-01T00:00:00.000Z';
      (service as any).store.account.notificationCursors.set('@city', newer);

      await service.clearNotifications(readDate, ['@city']);

      expect(patch).not.toHaveBeenCalled();
      http.expectNone(req => req.method === 'PATCH');
      expect((service as any).store.account.notificationCursors.get('@city')).toEqual(newer);
    });
  });

  it('ignores the read date when notifications remain', () => {
    setAccount();
    vi.spyOn((service as any).admin, 'getTemplate').mockReturnValue({});
    vi.spyOn(service, 'loadNotificationCursors$').mockReturnValue(of([
      { origin: '@city', query: '@city:inbox', settingsUrl: 'tag:/plugin/outbox/city' },
    ]));
    vi.spyOn((service as any).refs, 'count').mockReturnValue(of(3));
    const clear = vi.spyOn(service, 'clearNotifications').mockImplementation(() => Promise.resolve());
    const readDate = DateTime.fromISO('2026-04-01T00:00:00.000Z');

    service.clearNotificationsIfNone(readDate, '@city');

    expect(clear).not.toHaveBeenCalled();
    expect((service as any).store.account.ignoreNotifications).toContain(readDate.valueOf());
  });

  describe('loading cursors', () => {
    const inboxGet = () => http.expectOne(req =>
      req.method === 'GET' &&
      req.url.endsWith('/api/v1/tags/response') &&
      req.params.get('url') === 'tag:/plugin/inbox');
    const inboxRef = (cursor: string) => ({
      url: 'tag:/+user/dad?url=tag:/plugin/inbox',
      origin: '',
      plugins: { 'plugin/user/cursor': { cursor } },
      modified: cursor,
    });

    it('resets cursor state when switching accounts', () => {
      setAccount();
      const store = (service as any).store;
      service.loadNotificationCursors$().subscribe();
      expectSavedCursors();
      inboxGet().flush(inboxRef('2026-01-01T00:00:00.000Z'));
      (service as any).otherOrigins.add('@city');
      expect(store.account.notificationCursors.get('')).toEqual('2026-01-01T00:00:00.000Z');
      expect((service as any).cursorRefs.size).toBe(1);

      store.account.tag = '+user/mom';
      service.loadNotificationCursors$().subscribe();

      expect(store.account.notificationCursors.size).toBe(0);
      expect((service as any).cursorRefs.size).toBe(0);
      expect((service as any).otherOrigins.size).toBe(0);
      expectSavedCursors([], '+user/mom@');
      inboxGet().flush(inboxRef('2026-02-01T00:00:00.000Z'));
      expect(store.account.notificationCursors.get('')).toEqual('2026-02-01T00:00:00.000Z');
    });

    it('ignores in-flight loads from the previous account', () => {
      setAccount();
      const store = (service as any).store;
      service.loadNotificationCursors$().subscribe();
      expectSavedCursors();
      const stale = inboxGet();

      store.account.tag = '+user/mom';
      service.loadNotificationCursors$().subscribe();
      expectSavedCursors([], '+user/mom@');
      const current = inboxGet();
      const currentLoad = (service as any).cursorLoads.get('');

      stale.flush(inboxRef('2026-01-01T00:00:00.000Z'));
      expect(store.account.notificationCursors.has('')).toBe(false);
      expect((service as any).cursorRefs.size).toBe(0);
      expect((service as any).cursorLoads.get('')).toBe(currentLoad);

      current.flush(inboxRef('2026-02-01T00:00:00.000Z'));
      expect(store.account.notificationCursors.get('')).toEqual('2026-02-01T00:00:00.000Z');
      expect((service as any).cursorLoads.size).toBe(0);
    });

    it('loads saved cursors for origins without a mailbox', () => {
      setAccount();
      const store = (service as any).store;
      const saved = '2026-03-01T00:00:00.000Z';
      const page = vi.spyOn((service as any).refs, 'page').mockReturnValue(of(Page.of([
        { url: 'tag:/user/dad?url=tag:/plugin/outbox/city', origin: '', plugins: { 'plugin/user/cursor': { cursor: saved } } },
        { url: 'tag:/user/dad?url=tag:/plugin/outbox/town', origin: '', plugins: {} },
        { url: 'tag:/user/mom?url=tag:/plugin/outbox/village', origin: '', plugins: { 'plugin/user/cursor': { cursor: saved } } },
      ])));
      let streams: any[] = [];
      service.loadNotificationCursors$().subscribe(result => streams = result);
      inboxGet().flush(inboxRef('2026-01-01T00:00:00.000Z'));

      expect(page).toHaveBeenCalledWith(expect.objectContaining({ query: 'plugin/user/cursor:+user/dad@' }));
      expect(store.account.notificationCursors.get('@city')).toEqual(saved);
      expect(store.account.notificationCursors.has('@town')).toBe(false);
      expect(store.account.notificationCursors.has('@village')).toBe(false);
      expect(streams.map(stream => stream.origin)).toEqual(['', '@city']);

      service.loadNotificationCursors$().subscribe();
      expect(page).toHaveBeenCalledOnce();
    });

    it('shares one request between concurrent loads', () => {
      setAccount();
      const results: any[] = [];
      service.loadNotificationCursors$().subscribe(streams => results.push(streams));
      service.loadNotificationCursors$().subscribe(streams => results.push(streams));
      expectSavedCursors();
      inboxGet().flush(inboxRef('2026-01-01T00:00:00.000Z'));

      expect(results).toHaveLength(2);
      expect((service as any).cursorLoads.size).toBe(0);
    });

    it('passes on errors other than 404 and retries later', () => {
      setAccount();
      const error = vi.fn();
      service.loadNotificationCursors$().pipe(catchError(err => {
        error(err);
        return EMPTY;
      })).subscribe();
      expectSavedCursors();
      inboxGet().flush({}, { status: 500, statusText: 'Server Error' });

      expect(error).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
      expect((service as any).cursorLoads.size).toBe(0);
      expect((service as any).store.account.notificationCursors.has('')).toBe(false);

      service.loadNotificationCursors$().subscribe();
      inboxGet().flush(inboxRef('2026-01-01T00:00:00.000Z'));
      expect((service as any).store.account.notificationCursors.get('')).toEqual('2026-01-01T00:00:00.000Z');
    });
  });
});
