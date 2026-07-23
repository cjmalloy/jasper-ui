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
      clearNotifications: vi.fn(),
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
    const modified = DateTime.fromISO('2026-07-23T12:00:00Z');
    const page = Page.of<Ref>([{ url: 'spec:alarm', origin: '@remote', modified }]);

    notifications.next(page);

    expect(account.notificationPage$).toHaveBeenCalledWith(component.store.view.pageSize);
    expect(component.query.page).toBe(page);

    fixture.destroy();

    expect(account.clearNotifications).toHaveBeenCalledWith(modified, ['@remote']);
  });
});
