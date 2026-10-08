import { computed, signal } from '@angular/core';
import { intersection, uniq } from 'lodash-es';
import { Ext } from '../model/ext';
import { Roles, User } from '../model/user';
import { getMailbox } from '../mods/mailbox';
import { defaultSubs, UserConfig } from '../mods/user';
import { parseBookmarkParams } from '../util/http';
import { braces, defaultOrigin, hasPrefix, localTag, prefix, setPublic, tagOrigin } from '../util/tag';
import { OriginStore } from './origin';

export class AccountStore {

  readonly debug = signal<boolean>(false);
  readonly tag = signal<string>('');
  readonly origin = signal<string>('');
  readonly access = signal<User | undefined>(undefined);
  readonly ext = signal<Ext | undefined>(undefined);
  readonly defaultConfig = signal<UserConfig>({});
  readonly ignoreNotifications = signal<number[]>([]);
  /**
   * Notification read cursors keyed by origin.
   */
  readonly notificationCursors = new Map<string, string>();

  /**
   * Is admin.
   * Owns everything.
   * Limited to origin and sub origins.
   */
  admin = false;
  /**
   * Is mod.
   * Owns everything except plugins and templates.
   * Limited to origin and sub origins.
   */
  mod = false;
  /**
   * Is editor.
   * Allowed to toggle any public tag (except public and locked) to any Ref in view.
   * Limited to origin and sub origins.
   */
  editor = false;
  /**
   * Is user.
   * Allowed to post Refs.
   * May be given access to other tags.
   * Limited to origin and sub origins.
   */
  user = false;
  /**
   * Is viewer.
   * Allowed to edit user ext.
   * May be given read access to other tags.
   * May not be given write access to other tags.
   * Limited to origin and sub origins.
   */
  viewer = false;
  /**
   * Is banned.
   * No access, ban message shown instead.
   * Limited to origin and sub origins.
   */
  banned = false;
  /**
   * Unread inbox and alarms total count.
   */
  readonly notifications = signal<number>(0);
  /**
   * Unread alarms count.
   */
  readonly alarmCount = signal<number>(0);
  /**
   * Flag indicating the interceptor detected an unauthorized request.
   */
  readonly authError = signal<boolean>(false);
  /**
   * Flag indicating an unrecoverable error loading app from PWA cache.
   */
  readonly unrecoverable = signal<boolean>(false);

  constructor(
    private origins: OriginStore,
  ) { }

  readonly signedIn = computed(() => {
    return !!this.tag();
  });

  readonly root = computed(() => {
    return !this.origin();
  });

  readonly localTag = computed(() => {
    return localTag(this.tag());
  });

  readonly tagWithOrigin = computed(() => {
    return localTag(this.tag()) + (this.origin() || '@');
  });

  readonly userTag = computed(() => {
     if (hasPrefix(localTag(this.tag()), 'user')) return this.localTag();
     return '';
  });

  readonly role = computed(() => {
    if (!this.signedIn()) return '';
    if (this.admin) return 'admin';
    if (this.mod) return 'mod';
    if (this.editor) return 'editor';
    if (this.user) return 'user';
    if (this.viewer) return 'viewer';
    return 'anon';
  });

  readonly roles = computed((): Roles => {
    return {
      debug: this.debug(),
      tag: this.tag(),
      admin: this.admin,
      mod: this.mod,
      editor: this.editor,
      user: this.user,
      viewer: this.viewer,
      banned: this.banned,
    };
  });

  readonly config = computed((): UserConfig => {
    return {
      ...(this.defaultConfig() || {}),
      ...(this.ext()?.config || {}),
    };
  });

  readonly subs = computed((): string[] => {
    return this.config().subscriptions || defaultSubs;
  });

  readonly userSubs = computed((): string[] => {
    return this.subs().filter(s => hasPrefix(s, 'user'));
  });

  readonly tagSubs = computed((): string[] => {
    return this.subs().filter(s => !hasPrefix(s, 'user'));
  });

  readonly bookmarks = computed(() => {
    return this.config().bookmarks || [];
  });

  readonly bookmarkQueries = computed(() => {
    return this.bookmarks().map(b => b.includes('?') ? b.substring(0, b.indexOf('?')) : b);
  });

  readonly bookmarkParams = computed(() => {
    return this.bookmarks().map(b => parseBookmarkParams(b.includes('?') ? b.substring(b.indexOf('?')) : b));
  });

  readonly alarms = computed((): string[] => {
    return this.config().alarms || [];
  });

  readonly mailbox = computed(() => {
    if (!this.signedIn()) return undefined;
    return getMailbox(this.tag(), this.origin()) + (this.origin() || '@');
  });

  readonly modmail = computed(() => {
    return this.access()?.readAccess?.filter(t => hasPrefix(t, 'plugin/inbox')).map(t => defaultOrigin(t, this.origin() || '@'));
  });

  readonly outboxes = computed(() => {
    return Array.from(this.origins.reverseLookup())
      .map(([remote, localAlias]) => setPublic(prefix('plugin/outbox', localAlias, this.localTag())) + remote);
  });

  readonly aliasMailboxes = computed((): string[] => {
    if (!this.signedIn()) return [];
    const local = this.localTag();
    return uniq(this.origins.accountAliases()
      .filter(alias => (alias.from || '') === (this.origin() || ''))
      .filter(alias => local === alias.local || local.startsWith(alias.local + '/'))
      .map(alias => getMailbox(alias.remote + local.substring(alias.local.length), alias.origin) + alias.origin));
  });

  readonly inboxQuery = computed(() => {
    if (!this.signedIn()) return '';
    let tags = [this.mailbox()];
    if (this.origin()) {
      tags.push(setPublic(prefix('plugin/outbox', this.origin(), this.tagWithOrigin())) + this.origin());
    }
    tags.push(...this.modmail() || []);
    tags.push(...this.outboxes() || []);
    tags.push(...this.aliasMailboxes());
    return uniq(tags).join('|');
  });

  readonly notificationsQuery = computed(() => {
    if (!this.signedIn()) return undefined;
    const alarms = this.alarmsQuery() ? '|' + this.alarmsQuery() : '';
    return `!${this.tag()}:!plugin/delete:` + braces(this.inboxQuery() + alarms);
  });

  readonly alarmNotificationsQuery = computed(() => {
    if (!this.signedIn()) return undefined;
    if (!this.alarmsQuery()) return '';
    return `!${this.tag()}:!plugin/delete:` + braces(this.alarmsQuery()!);
  });

  /**
   * Unread inbox count, not including alarms.
   */
  readonly unreadCount = computed(() => Math.max(0, this.notifications() - this.alarmCount()));

  readonly alarmsQuery = computed(() => {
    if (!this.signedIn()) return undefined;
    return this.config().alarms?.join('|') || '';
  });

  readonly subscriptionQuery = computed(() => {
    if (!this.tagSubs().length) return 'none';
    return '!internal:(' + this.tagSubs().join('|') + ')';
  });

  querySymbol(...ops: ('/' | '{' | '}' | ',' | ':' | '|' | '(' | ')' | `!`)[]): string {
    return ops.map(op => {
      if (this.config().queryStyle === 'set') {
        switch (op) {
          case '/': return $localize`\u00A0/ `;
          case ':': return $localize` ∩ `;
          case '|': return $localize` ∪ `;
          case '(': return $localize` (\u00A0`;
          case ')': return $localize`\u00A0) `;
          case `!`: return $localize`' `;
          case `{`: return $localize` {\u00A0`;
          case `}`: return $localize`\u00A0} `;
          case `,`: return $localize`, `;
        }
      }
      if (this.config().queryStyle === 'logic') {
        switch (op) {
          case '/': return $localize`\u00A0/ `;
          case ':': return $localize` & `;
          case '|': return $localize` | `;
          case '(': return $localize` (\u00A0`;
          case ')': return $localize`\u00A0) `;
          case `!`: return $localize` ¬`;
          case `{`: return $localize` {\u00A0`;
          case `}`: return $localize`\u00A0} `;
          case `,`: return $localize` | `;
        }
      }
      if (this.config().queryStyle === 'code') {
        switch (op) {
          case '/': return $localize`\u00A0/ `;
          case ':': return $localize` & `;
          case '|': return $localize`, `;
          case '(': return $localize` (\u00A0`;
          case ')': return $localize`\u00A0) `;
          case `!`: return $localize` !`;
          case `{`: return $localize` {\u00A0`;
          case `}`: return $localize`\u00A0} `;
          case `,`: return $localize`, `;
        }
      }

      switch (op) {
        case '/': return $localize`\u00A0/ `;
        case ':': return $localize` : `;
        case '|': return $localize` | `;
        case '(': return $localize` (\u00A0`;
        case ')': return $localize`\u00A0) `;
        case `!`: return $localize` ❗`;
        case `{`: return $localize` {\u00A0`;
        case `}`: return $localize`\u00A0} `;
        case `,`: return $localize`, `;
      }
      return op;
    }).join(' ');
  }

  setRoles(roles: Roles) {
    this.debug.set(roles.debug);
    this.origin.set(tagOrigin(roles.tag));
    this.tag.set(roles.tag || '');
    if (this.tag().startsWith('@')) {
      // Not logged in, only local origin is set
      this.tag.set('');
    }
    this.admin = roles.admin;
    this.mod = roles.mod;
    this.editor = roles.editor;
    this.user = roles.user;
    this.viewer = roles.viewer;
    this.banned = roles.banned;
  }

  defaultEditors(plugins: string[]) {
    if (!this.config()?.editors) return [];
    return intersection(this.config().editors, plugins);
  }
}
