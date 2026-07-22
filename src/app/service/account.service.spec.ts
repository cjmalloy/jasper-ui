/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DateTime } from 'luxon';
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
    const origins = (service as any).origins;
    origins.origins = [
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
    ] as Ref[];

    const streams = service.notificationStreams;
    expect(streams.filter(stream => stream.origin === '@city')).toHaveLength(1);
    expect(streams.find(stream => stream.origin === '@city')?.query).toContain('user/chris');
    expect(streams.find(stream => stream.origin === '@city')?.query).toContain('user/cj');
    expect(streams.find(stream => stream.origin === '@city')?.settingsUrl).toEqual('tag:/plugin/outbox/city');
    expect(streams.find(stream => stream.origin === '@town')?.settingsUrl).toEqual('tag:/plugin/outbox/town');
  });

  it('loads independent cursors for multiple origins', () => {
    setAccount();
    const origins = (service as any).origins;
    origins.origins = [
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
    ] as Ref[];

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
});
