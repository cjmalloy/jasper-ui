import { Ref } from '../model/ref';
import { getMailbox, isMailbox, mailboxes, notifications } from './mailbox';

describe('MailboxPlugin', () => {
  it('isMailbox', () => {
    expect(isMailbox('plugin/inbox/test')).toBeTruthy();
    expect(isMailbox('+plugin/inbox/test')).toBeFalsy();
    expect(isMailbox('_plugin/inbox/test')).toBeFalsy();
    expect(isMailbox('plugin/outbox/origin/test')).toBeTruthy();
    expect(isMailbox('+plugin/outbox/origin/test')).toBeFalsy();
    expect(isMailbox('_plugin/outbox/origin/test')).toBeFalsy();
    expect(isMailbox('user/bob')).toBeFalsy();
    expect(isMailbox('+user/bob')).toBeFalsy();
    expect(isMailbox('_user/bob')).toBeFalsy();
  });
  const ref = (...tags: string[]): Ref => ({ url: 'spec:test', tags });
  it('notifications', () => {
    expect(notifications(ref('plugin/inbox/test'))).toEqual(['plugin/inbox/test']);
    expect(notifications(ref('+plugin/inbox/test'))).toEqual([]);
    expect(notifications(ref('_plugin/inbox/test'))).toEqual([]);
    expect(notifications(ref('plugin/outbox/origin/test'))).toEqual(['plugin/outbox/origin/test']);
    expect(notifications(ref('+plugin/outbox/origin/test'))).toEqual([]);
    expect(notifications(ref('_plugin/outbox/origin/test'))).toEqual([]);
    expect(notifications(ref('user/bob'))).toEqual([]);
    expect(notifications(ref('+user/bob'))).toEqual([]);
    expect(notifications(ref('_user/bob'))).toEqual([]);
  });
  it('getMailbox', () => {
    expect(getMailbox('user/bob', '')).toEqual('plugin/inbox/user/bob');
    expect(getMailbox('+user/bob', '')).toEqual('plugin/inbox/user/bob');
    expect(getMailbox('_user/bob', '')).toEqual('plugin/inbox/user/bob');
    expect(getMailbox('user/bob@test', '')).toEqual('plugin/outbox/test/user/bob');
    expect(getMailbox('+user/bob@test', '')).toEqual('plugin/outbox/test/user/bob');
    expect(getMailbox('_user/bob@test', '')).toEqual('plugin/outbox/test/user/bob');
  });
  it('getLocalMailbox', () => {
    expect(getMailbox('plugin/inbox/user/bob', '')).toEqual('plugin/inbox/user/bob');
    expect(getMailbox('plugin/outbox/test/user/bob', '')).toEqual('plugin/outbox/test/user/bob');
    expect(getMailbox('user/bob', '')).toEqual('plugin/inbox/user/bob');
    expect(getMailbox('user/bob@test', '')).toEqual('plugin/outbox/test/user/bob');
    expect(getMailbox('user/bob@test', '@test')).toEqual('plugin/inbox/user/bob');
  });
  const refAt = (origin: string, ...tags: string[]): Ref => ({ url: 'spec:test', origin, tags });
  it('mailboxes', () => {
    expect(mailboxes(ref('+user', 'public'), '+user')).toEqual([]);
    expect(mailboxes(ref('+user/alice'), '+user')).toEqual(['plugin/inbox/user/alice', 'user/alice']);
    expect(mailboxes(ref('+user/alice', 'public'), '+user')).toEqual(['plugin/inbox/user/alice']);
    expect(mailboxes(ref('+user', 'plugin/inbox/user/alice', 'public'), '+user')).toEqual(['plugin/inbox/user/alice']);
    expect(mailboxes(ref('+user/alice', 'plugin/inbox/user/bob', 'public'), '+user')).toEqual(['plugin/inbox/user/alice', 'plugin/inbox/user/bob']);
    expect(mailboxes(ref('_user/alice'), '+user')).toEqual(['plugin/inbox/user/alice', '_user/alice']);
    expect(mailboxes(ref('+user/alice', '_user/bob'), '+user')).toEqual(['plugin/inbox/user/alice', 'plugin/inbox/user/bob', 'user/alice', '_user/bob']);
  });
  it('mailboxes multi-tenant', () => {
    expect(mailboxes(ref('+user/alice'), '+user@test')).toEqual(['plugin/inbox/user/alice', 'user/alice']);
    expect(mailboxes(ref('+user/alice', 'public'), '+user@test')).toEqual(['plugin/inbox/user/alice']);
    expect(mailboxes(ref('+user/alice', 'plugin/inbox/user/bob'), '+user@test')).toEqual(['plugin/inbox/user/alice', 'user/alice', 'plugin/inbox/user/bob']);
    expect(mailboxes(ref('+user/alice', 'plugin/inbox/user/bob', 'public'), '+user@test')).toEqual(['plugin/inbox/user/alice', 'plugin/inbox/user/bob']);
    expect(mailboxes(refAt('@test'), '+user')).toEqual([]);
    expect(mailboxes(refAt('@test', '+user', 'public'), '+user@test')).toEqual([]);
    expect(mailboxes(refAt('@test', '+user/alice'), '+user')).toEqual(['plugin/outbox/test/user/alice']);
    expect(mailboxes(refAt('@test', 'plugin/inbox/user/alice'), '+user')).toEqual(['plugin/outbox/test/user/alice']);
    expect(mailboxes(refAt('@test', '+user/alice', 'plugin/inbox/user/bob'), '+user')).toEqual(['plugin/outbox/test/user/alice', 'plugin/outbox/test/user/bob']);
    expect(mailboxes(refAt('@test', '+user/alice', 'plugin/inbox/user/bob', 'public'), '+user@test')).toEqual(['plugin/inbox/user/alice', 'plugin/inbox/user/bob']);
  });
  it('mailboxes multi-tenant with lookup', () => {
    const lookup = new Map([
      ['@test', new Map([
        ['@a', '@b'],
        ['@c', '@d'],
      ])],
      ['@other', new Map([
        ['@bla', '@bla'],
      ])],
    ]);
    expect(mailboxes(refAt('@test'), '+user', lookup)).toEqual([]);
    expect(mailboxes(refAt('@test', '+user/alice'), '+user', lookup)).toEqual(['plugin/outbox/test/user/alice']);
    expect(mailboxes(refAt('@test', 'plugin/inbox/user/alice'), '+user', lookup)).toEqual(['plugin/outbox/test/user/alice']);
    expect(mailboxes(refAt('@test', 'plugin/outbox/a/user/alice'), '+user', lookup)).toEqual(['plugin/outbox/b/user/alice']);
    expect(mailboxes(refAt('@test', '+user/alice', 'plugin/inbox/user/bob'), '+user', lookup)).toEqual(['plugin/outbox/test/user/alice', 'plugin/outbox/test/user/bob']);
    expect(mailboxes(refAt('@test', 'plugin/outbox/a/user/alice', 'plugin/outbox/c/user/bob'), '+user', lookup)).toEqual(['plugin/outbox/b/user/alice', 'plugin/outbox/d/user/bob']);
  });
});
