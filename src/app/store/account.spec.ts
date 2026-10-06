/// <reference types="vitest/globals" />
import { AccountStore } from './account';
import { OriginStore } from './origin';

describe('AccountStore notifications', () => {
  function createStore(alarms?: string[]) {
    const store = new AccountStore(new OriginStore());
    store.tag = '+user/alice';
    store.ext = { tag: '+user/alice', origin: '', config: { alarms } } as any;
    return store;
  }

  it('applies user and delete filters to inbox only when there are no alarms', () => {
    const store = createStore();
    expect(store.notificationsQuery).toBe('!+user/alice:!plugin/delete:plugin/inbox/user/alice@');
    expect(store.alarmNotificationsQuery).toBe('');
  });

  it('applies user and delete filters to alarms', () => {
    const store = createStore(['science', 'math']);
    expect(store.notificationsQuery).toBe('!+user/alice:!plugin/delete:(plugin/inbox/user/alice@|science|math)');
    expect(store.alarmNotificationsQuery).toBe('!+user/alice:!plugin/delete:(science|math)');
  });

  it('applies user and delete filters to a single alarm', () => {
    const store = createStore(['science']);
    expect(store.alarmNotificationsQuery).toBe('!+user/alice:!plugin/delete:science');
  });

  it('subtracts alarms from unread count', () => {
    const store = createStore(['science']);
    store.notifications = 5;
    store.alarmCount = 2;
    expect(store.unreadCount).toBe(3);
  });

  it('never shows a negative unread count', () => {
    const store = createStore(['science']);
    store.notifications = 1;
    store.alarmCount = 3;
    expect(store.unreadCount).toBe(0);
  });
});
