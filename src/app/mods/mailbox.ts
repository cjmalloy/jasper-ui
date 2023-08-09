import { filter, maxBy, uniq } from 'lodash-es';
import * as moment from 'moment';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { Template } from '../model/template';
import { authors } from '../util/format';
import { hasPrefix, localTag, prefix, removePrefix, tagOrigin } from '../util/tag';

export const dmTemplate: Template = {
  tag: 'dm',
  name: $localize`✉️ DM`,
  config: {
    mod: '📮️ Mailbox',
    default: true,
    internal: true,
    generated: 'Generated by jenkins-ui ' + moment().toISOString(),
    description: $localize`Adds dms tab to inbox. Adds buttons to create private direct messages with users.`,
    filters: [
      { query: 'dm', label: $localize`✉️ dm`, group: $localize`Templates 🎨️` },
    ],
  },
};

export const inboxPlugin: Plugin = {
  tag: 'plugin/inbox',
  name: $localize`✉️ Inbox`,
  config: {
    mod: '📮️ Mailbox',
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`'The inbox plugin allow sending notifications to another user
      on the same server.'`,
    readAccess: ['plugin/inbox'],
  },
};

export const outboxPlugin: Plugin = {
  tag: 'plugin/outbox',
  name: $localize`📬️ Outbox`,
  config: {
    mod: '📮️ Mailbox',
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`The outbox plugin allow sending notifications to another user on
      a remote or multi-tenant server.`,
    icons: [{ label: $localize`📬️`, title: $localize`Notifications in outbox` }],
    filters: [
      { query: 'plugin/outbox', label: $localize`📬️ outbox`, group: $localize`Plugins 🧰️` },
    ],
  },
};

export function isMailbox(tag: string) {
  return tag.startsWith('plugin/inbox') ||
    tag.startsWith('plugin/outbox');
}

export function notifications(ref: Ref): string[] {
  return filter(ref.tags || [], isMailbox);
}

export function addressedTo(ref: Ref): string[] {
  return notifications(ref).map(getUser).filter(u => u) as string[];
}

export function getUser(mailbox: string): string | undefined {
  const tag = getMailboxTag(mailbox);
  if (!tag) return tag;
  if (mailbox.startsWith('_')) return '_' + tag;
  if (tag == 'user') return '+user';
  if (tag.startsWith('user/')) return '+' + tag;
  return tag;
}

export function getMailboxTag(mailbox: string): string | undefined {
  if (mailbox.startsWith('_plugin/inbox/')) return mailbox.substring('_plugin/inbox/'.length);
  if (mailbox.startsWith('plugin/inbox/')) return mailbox.substring('plugin/inbox/'.length);
  if (mailbox.startsWith('_plugin/outbox/')) return reverseOrigin(mailbox.substring('_plugin/outbox/'.length));
  if (mailbox.startsWith('plugin/outbox/')) return reverseOrigin(mailbox.substring('plugin/outbox/'.length));
  if (mailbox.startsWith('_plugin/from/')) return reverseOrigin(mailbox.substring('_plugin/from/'.length));
  if (mailbox.startsWith('plugin/from/')) return reverseOrigin(mailbox.substring('plugin/from/'.length));
  return undefined;
}

/**
 * Convert from reverse origin syntax (origin/tag) to qualified tag syntax (tag@origin).
 */
export function reverseOrigin(tag: string): string {
  let prefix = '';
  if (tag.startsWith('+') || tag.startsWith('_')) {
    prefix = tag.substring(0, 1);
    tag = tag.substring(1);
  }
  const len = tag.indexOf('/');
  return prefix + tag.substring(len + 1) + '@' + tag.substring(0, len);
}

export function getMailbox(tag: string, local = ''): string {
  if (hasPrefix(tag, 'plugin/inbox') || hasPrefix(tag, 'plugin/outbox')) return tag;
  if (hasPrefix(tag, 'plugin')) return tag;
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