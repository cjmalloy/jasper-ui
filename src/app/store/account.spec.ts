/// <reference types="vitest/globals" />
import { AccountStore } from './account';
import { OriginStore } from './origin';

describe('AccountStore notifications', () => {
  function createStore(alarms?: string[]) {
    const store = new AccountStore(new OriginStore());
    store.tag.set('+user/alice');
    store.ext.set({ tag: '+user/alice', origin: '', config: { alarms } } as any);
    return store;
  }

  it('applies user and delete filters to inbox only when there are no alarms', () => {
    const store = createStore();
    expect(store.notificationsQuery()).toBe('!+user/alice:!plugin/delete:plugin/inbox/user/alice@');
    expect(store.alarmNotificationsQuery()).toBe('');
  });

  it('applies user and delete filters to alarms', () => {
    const store = createStore(['science', 'math']);
    expect(store.notificationsQuery()).toBe('!+user/alice:!plugin/delete:(plugin/inbox/user/alice@|science|math)');
    expect(store.alarmNotificationsQuery()).toBe('!+user/alice:!plugin/delete:(science|math)');
  });

  it('applies user and delete filters to a single alarm', () => {
    const store = createStore(['science']);
    expect(store.alarmNotificationsQuery()).toBe('!+user/alice:!plugin/delete:science');
  });

  it('subtracts alarms from unread count', () => {
    const store = createStore(['science']);
    store.notifications.set(5);
    store.alarmCount.set(2);
    expect(store.unreadCount()).toBe(3);
  });

  it('never shows a negative unread count', () => {
    const store = createStore(['science']);
    store.notifications.set(1);
    store.alarmCount.set(3);
    expect(store.unreadCount()).toBe(0);
  });

  it('includes alias mailboxes in the inbox query', () => {
    const origins = new OriginStore();
    const store = new AccountStore(origins);
    store.tag.set('+user/alice');
    store.ext.set({ tag: '+user/alice', origin: '', config: {} } as any);
    origins.accountAliases.set([
      { from: '', origin: '@repl', local: '+user/alice', remote: '+user/charlie' },
      { from: '', origin: '@repl', local: '+user/alice/phone', remote: '+user/dave' },
      { from: '', origin: '@repl', local: '+user/alicia', remote: '+user/eve' },
      { from: '@b', origin: '@c', local: '+user/alice', remote: '+user/mallory' },
    ]);
    expect(store.aliasMailboxes()).toEqual(['plugin/inbox/user/charlie@repl']);
    expect(store.inboxQuery()).toBe('plugin/inbox/user/alice@|plugin/inbox/user/charlie@repl');
  });
});
