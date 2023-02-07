import { filter, maxBy, uniq } from 'lodash-es';
import * as moment from 'moment';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { authors } from '../util/format';
import { hasPrefix, localTag, prefix, removePrefix, tagOrigin } from '../util/tag';

export const inboxPlugin: Plugin = {
  tag: 'plugin/inbox',
  name: $localize`Inbox`,
  config: {
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`'The inbox plugin allow sending notifications to another user
      on the same server.'`,
    readAccess: ['plugin/inbox'],
  },
};

export const outboxPlugin: Plugin = {
  tag: 'plugin/outbox',
  name: $localize`Outbox`,
  config: {
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`The outbox plugin allow sending notifications to another user on
      a remote or multi-tenant server.`,
  },
};

export function isMailbox(tag: string) {
  return tag.startsWith('plugin/inbox') ||
    tag.startsWith('plugin/outbox');
}

export function notifications(ref: Ref): string[] {
  return filter(ref.tags || [], isMailbox);
}

export function getMailbox(tag: string, local = ''): string {
  if (hasPrefix(tag, 'plugin/inbox') || hasPrefix(tag, 'plugin/outbox')) return tag;
  const origin = tagOrigin(tag);
  if (!origin || origin === local) {
    return prefix('plugin/inbox', localTag(tag));
  } else {
    return prefix(`plugin/outbox/${origin.substring(1)}`, localTag(tag));
  }
}

export function getLocalMailbox(mailbox: string, local: string, origin: string, lookup?: Map<string, Map<string, string>>) {
  if (!origin || origin === local) return mailbox;
  if (hasPrefix(mailbox, 'plugin/outbox')) {
    if (!lookup?.get(origin)) {
      console.warn('Cannot lookup mailbox translation for', origin);
      return undefined;
    }
    const remote = '@' + mailbox.split('/')[2];
    if (!lookup.get(origin)!.has(remote)) {
      console.warn('Cannot lookup mailbox translation for', origin, 'on remote', remote);
      return undefined;
    }
    const mapped = lookup.get(origin)!.get(remote);
    if (!mapped || mapped === local) {
      return 'plugin/inbox/' + removePrefix(mailbox, 3);
    }
    return `plugin/outbox/${mapped.substring(1)}/${removePrefix(mailbox, 3)}`;
  }
  if (hasPrefix(mailbox, 'plugin/inbox')) {
    return `plugin/outbox/${origin.substring(1)}/${removePrefix(mailbox, 2)}`;
  }
  throw 'not a mailbox';
}

export function mailboxes(ref: Ref, myUserTag: string, lookup?: Map<string, Map<string, string>>): string[] {
  const local = tagOrigin(myUserTag);
  return uniq([
    ...authors(ref).filter(tag => tag !== myUserTag).map(tag => getMailbox(tag, local)),
    ...notifications(ref).map(m => getLocalMailbox(m, local, ref.origin || '', lookup)).filter(t => !!t) as string[],
  ]);
}

export function newest(refs: Ref[]) {
  return maxBy(refs, r => r.modified!.valueOf());
}
