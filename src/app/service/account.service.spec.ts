/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DateTime } from 'luxon';
import { of } from 'rxjs';
import { Page } from '../model/page';
import { Ref } from '../model/ref';

import { AccountService } from './account.service';

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

  const expectCursorRequest = (cursor?: string) => {
    const get = http.expectOne(req =>
      req.method === 'GET' &&
      req.url.endsWith('/api/v1/tags/response') &&
      req.params.get('url') === 'tag:/plugin/inbox');
    get.flush({}, { status: 404, statusText: 'Not Found' });
    const create = http.expectOne(req =>
      req.method === 'PATCH' &&
      req.url.endsWith('/api/v1/tags/response') &&
      req.params.get('url') === 'tag:/plugin/inbox');
    if (cursor) expect(create.request.body['plugin/user/cursor'].cursor).toEqual(cursor);
    create.flush(null);
    const reload = http.expectOne(req =>
      req.method === 'GET' &&
      req.url.endsWith('/api/v1/tags/response') &&
      req.params.get('url') === 'tag:/plugin/inbox');
    reload.flush({
      url: 'tag:/+user/dad?url=tag:/plugin/inbox',
      origin: '',
      tags: ['+user/dad', 'plugin/user/cursor'],
      plugins: { 'plugin/user/cursor': {
        cursor: create.request.body['plugin/user/cursor'].cursor,
      } },
      modified: '2026-01-01T00:00:00.000Z',
    });
    return create.request.body['plugin/user/cursor'].cursor as string;
  };

  it('initializes a missing cursor at the current time', () => {
    setAccount();
    const before = DateTime.now();
    service.loadNotificationCursors$().subscribe();
    const cursor = expectCursorRequest();

    expect(DateTime.fromISO(cursor) >= before).toBeTruthy();
    expect((service as any).store.account.notificationCursors.get('')).toEqual(cursor);
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

  it('only creates alarm streams for origins with a loaded cursor', () => {
    setAccount();
    const store = (service as any).store;
    store.account.ext.config.alarms = ['alarm'];
    store.origins.list = ['', '@city', '@town'];
    store.account.notificationCursors.set('@city', '2026-01-01T00:00:00.000Z');

    const streams = service.notificationStreams;

    expect(streams.find(stream => stream.origin === '@town')).toBeUndefined();
    expect(streams.find(stream => stream.origin === '@city')?.query).toEqual('@city:!plugin/delete:(alarm)');
    expect(streams.find(stream => stream.origin === '@city')?.alarmQuery).toEqual('@city:!plugin/delete:(alarm)');
    expect(streams.find(stream => stream.origin === '@city')?.settingsUrl).toEqual('tag:/plugin/outbox/city');
  });

  describe('alarm origin discovery', () => {
    const localCursor = '2026-01-01T00:00:00.000Z';

    beforeEach(() => {
      setAccount();
      const store = (service as any).store;
      store.account.ext.config.alarms = ['alarm'];
      store.origins.list = ['', '@city', '@town'];
      (service as any).cursorAccount = store.account.tagWithOrigin;
      store.account.notificationCursors.set('', localCursor);
    });

    it('does not write a cursor for an origin that never produced an alarm', () => {
      let result: any;
      service.discoverAlarmOrigins$().subscribe(streams => result = streams);
      const search = http.expectOne(req =>
        req.method === 'GET' &&
        req.url.endsWith('/api/v1/ref/page'));
      expect(search.request.params.get('query')).toEqual('!plugin/delete:(alarm):!@');
      expect(search.request.params.get('modifiedAfter')).toEqual(localCursor);
      search.flush({ content: [], page: { number: 0, size: 20, totalElements: 0, totalPages: 0 } });

      expect(result.map((stream: any) => stream.origin)).toEqual(['']);
      expect(Array.from((service as any).store.account.notificationCursors.keys())).toEqual(['']);
    });

    it('creates the cursor for a new alarm origin at the local cursor', () => {
      let result: any;
      service.discoverAlarmOrigins$().subscribe(streams => result = streams);
      http.expectOne(req => req.method === 'GET' && req.url.endsWith('/api/v1/ref/page')).flush({
        content: [{ url: 'https://example.com/alarm', origin: '@city', tags: ['alarm'] }],
        page: { number: 0, size: 20, totalElements: 1, totalPages: 1 },
      });
      const get = http.expectOne(req =>
        req.method === 'GET' &&
        req.url.endsWith('/api/v1/tags/response') &&
        req.params.get('url') === 'tag:/plugin/outbox/city');
      get.flush({}, { status: 404, statusText: 'Not Found' });
      const create = http.expectOne(req =>
        req.method === 'PATCH' &&
        req.url.endsWith('/api/v1/tags/response') &&
        req.params.get('url') === 'tag:/plugin/outbox/city');
      expect(create.request.body['plugin/user/cursor'].cursor).toEqual(localCursor);
      create.flush(null);
      http.expectOne(req =>
        req.method === 'GET' &&
        req.url.endsWith('/api/v1/tags/response') &&
        req.params.get('url') === 'tag:/plugin/outbox/city').flush({
        url: 'tag:/+user/dad?url=tag:/plugin/outbox/city',
        origin: '',
        plugins: { 'plugin/user/cursor': { cursor: localCursor } },
        modified: localCursor,
      });

      expect(result.map((stream: any) => stream.origin)).toEqual(['', '@city']);
      expect((service as any).store.account.notificationCursors.get('@city')).toEqual(localCursor);
    });
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
      count.mockImplementation((args: any) => of(args.query.endsWith(':(science)') ? 1 : 3));
      service.checkNotifications();
      expect(store.account.notifications).toBe(6);
      expect(store.account.alarmCount).toBe(2);
      expect(store.account.unreadCount).toBe(4);
    });

    it('resets alarm count when alarms are removed', () => {
      const store = (service as any).store;
      count.mockImplementation((args: any) => of(args.query.endsWith(':(science)') ? 1 : 3));
      service.checkNotifications();
      store.account.ext = { tag: '+user/dad', origin: '', config: { alarms: [] } };
      load.mockReturnValue(of(streams.map(({ alarmQuery, ...stream }) => stream)));
      count.mockReturnValue(of(2));
      service.checkNotifications();
      expect(count).toHaveBeenCalledTimes(6);
      expect(store.account.notifications).toBe(4);
      expect(store.account.alarmCount).toBe(0);
      expect(store.account.unreadCount).toBe(4);
    });
  });
});
