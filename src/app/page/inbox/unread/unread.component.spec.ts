/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DateTime } from 'luxon';
import { BehaviorSubject } from 'rxjs';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { AccountService } from '../../../service/account.service';
import { RefService } from '../../../service/api/ref.service';

import { InboxUnreadPage } from './unread.component';

describe('InboxUnreadPage', () => {
  let component: InboxUnreadPage;
  let fixture: ComponentFixture<InboxUnreadPage>;
  let notifications: BehaviorSubject<Page<Ref>>;
  let account: {
    notificationPage$: ReturnType<typeof vi.fn>;
    clearNotifications: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    notifications = new BehaviorSubject(Page.of<Ref>([]));
    account = {
      notificationPage$: vi.fn(() => notifications),
      clearNotifications: vi.fn(() => Promise.resolve()),
    };
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => InboxUnreadPage)],
      providers: [
        { provide: RefService, useValue: { page: () => new BehaviorSubject<Page<Ref>>(Page.of([])) } },
        { provide: AccountService, useValue: account },
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InboxUnreadPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    vi.runAllTimers();
  });

  afterEach(() => vi.useRealTimers());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads notifications and clears each read origin', () => {
    const modifiedString = '2026-07-23T12:00:00.000100Z';
    const page = Page.of<Ref>([{ url: 'spec:alarm', origin: '@remote', modified: DateTime.fromISO(modifiedString), modifiedString }]);

    notifications.next(page);

    expect(account.notificationPage$).toHaveBeenCalledWith(component.store.view.pageSize());
    expect(component.query.page()).toBe(page);

    fixture.destroy();

    expect(account.clearNotifications).toHaveBeenCalledWith(modifiedString, ['@remote']);
  });

  it('keeps sub-millisecond read positions', () => {
    notifications.next(Page.of<Ref>([
      { url: 'spec:a', origin: '@remote', modified: DateTime.fromISO('2026-07-23T12:00:00.000Z'), modifiedString: '2026-07-23T12:00:00.000100Z' },
      { url: 'spec:b', origin: '@remote', modified: DateTime.fromISO('2026-07-23T12:00:00.000Z'), modifiedString: '2026-07-23T12:00:00.000200Z' },
    ]));

    fixture.destroy();

    expect(account.clearNotifications).toHaveBeenCalledWith('2026-07-23T12:00:00.000200Z', ['@remote']);
  });

  it('waits for cursor writes when the page number is reset', async () => {
    let resolve!: () => void;
    account.clearNotifications.mockImplementation(() => new Promise<void>(done => resolve = done));
    notifications.next(Page.of<Ref>([
      { url: 'spec:city', origin: '@city', modified: DateTime.fromISO('2026-07-23T12:00:00Z'), modifiedString: '2026-07-23T12:00:00Z' },
    ]));

    component.store.view.defaultPageNumber.set(1);
    TestBed.tick();
    component.store.view.defaultPageNumber.set(0);
    TestBed.tick();
    await vi.runAllTimersAsync();
    expect(account.notificationPage$).toHaveBeenCalledTimes(1);

    resolve();
    await vi.runAllTimersAsync();
    expect(account.notificationPage$).toHaveBeenCalledTimes(2);
  });

  it('reloads notifications after clearing every read origin', async () => {
    const resolvers: (() => void)[] = [];
    account.clearNotifications.mockImplementation(() => new Promise<void>(resolve => resolvers.push(() => resolve())));
    notifications.next(Page.of<Ref>([
      { url: 'spec:city', origin: '@city', modified: DateTime.fromISO('2026-07-23T12:00:00Z'), modifiedString: '2026-07-23T12:00:00Z' },
      { url: 'spec:town', origin: '@town', modified: DateTime.fromISO('2026-07-23T12:01:00Z'), modifiedString: '2026-07-23T12:01:00Z' },
    ]));

    component.store.view.defaultPageNumber.set(1);
    TestBed.tick();
    vi.runAllTimers();

    expect(account.clearNotifications).toHaveBeenCalledTimes(2);
    expect(account.notificationPage$).toHaveBeenCalledTimes(1);

    resolvers[0]();
    await Promise.resolve();
    expect(account.notificationPage$).toHaveBeenCalledTimes(1);

    resolvers[1]();
    await vi.runAllTimersAsync();
    expect(account.notificationPage$).toHaveBeenCalledTimes(2);
  });

  it('does not reload notifications after destruction', async () => {
    let resolve!: () => void;
    account.clearNotifications.mockImplementation(() => new Promise<void>(done => resolve = done));
    notifications.next(Page.of<Ref>([
      { url: 'spec:city', origin: '@city', modified: DateTime.fromISO('2026-07-23T12:00:00Z'), modifiedString: '2026-07-23T12:00:00Z' },
    ]));

    component.store.view.defaultPageNumber.set(1);
    TestBed.tick();
    vi.runAllTimers();
    fixture.destroy();
    resolve();
    await vi.runAllTimersAsync();

    expect(account.notificationPage$).toHaveBeenCalledTimes(1);
  });
});
