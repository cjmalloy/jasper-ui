/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Store } from '../store/store';
import { AdminService } from './admin.service';
import { RefService } from './api/ref.service';

import { AccountService } from './account.service';

describe('AccountService', () => {
  let service: AccountService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    service = TestBed.inject(AccountService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('checkNotifications', () => {
    let store: Store;
    let count: any;

    beforeEach(() => {
      store = TestBed.inject(Store);
      store.account.tag = '+user/alice';
      store.account.ext = { tag: '+user/alice', origin: '', config: { alarms: ['science'] } } as any;
      vi.spyOn(TestBed.inject(AdminService), 'getTemplate').mockReturnValue({ tag: 'user' } as any);
      Object.defineProperty(service, 'userExt$', { get: () => of(store.account.ext) });
      count = vi.spyOn(TestBed.inject(RefService), 'count');
    });

    it('updates notifications and alarm counts together', () => {
      count.mockImplementation((args: any) => of(args.query === store.account.alarmNotificationsQuery ? 2 : 5));
      service.checkNotifications();
      expect(store.account.notifications).toBe(5);
      expect(store.account.alarmCount).toBe(2);
      expect(store.account.unreadCount).toBe(3);
    });

    it('resets alarm count when alarms are removed', () => {
      count.mockImplementation((args: any) => of(args.query === store.account.alarmNotificationsQuery ? 2 : 5));
      service.checkNotifications();
      store.account.ext = { tag: '+user/alice', origin: '', config: { alarms: [] } } as any;
      count.mockReturnValue(of(3));
      service.checkNotifications();
      expect(count).toHaveBeenCalledTimes(3);
      expect(store.account.notifications).toBe(3);
      expect(store.account.alarmCount).toBe(0);
      expect(store.account.unreadCount).toBe(3);
    });
  });
});
