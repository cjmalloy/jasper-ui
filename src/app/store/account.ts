import { computed, signal } from '@angular/core';
import { intersection, uniq } from 'lodash-es';
import { Ext } from '../model/ext';
import { Roles, User } from '../model/user';
import { getMailbox } from '../mods/mailbox';
import { defaultSubs, UserConfig } from '../mods/user';
import { parseBookmarkParams, parseParams } from '../util/http';
import { braces, defaultOrigin, hasPrefix, localTag, prefix, setPublic, tagOrigin } from '../util/tag';
import { OriginStore } from './origin';

export class AccountStore {

  private readonly _debug = signal<boolean>(false);
  private readonly _tag = signal<string>('');
  private readonly _origin = signal<string>('');
  private readonly _access = signal<User | undefined>(undefined);
  private readonly _ext = signal<Ext | undefined>(undefined);
  private readonly _defaultConfig = signal<UserConfig>({});
  private readonly _ignoreNotifications = signal<number[]>([]);
  private readonly _admin = signal<boolean>(false);
  private readonly _mod = signal<boolean>(false);
  private readonly _editor = signal<boolean>(false);
  private readonly _user = signal<boolean>(false);
  private readonly _viewer = signal<boolean>(false);
  private readonly _banned = signal<boolean>(false);
  private readonly _notifications = signal<number>(0);
  private readonly _alarmCount = signal<number>(0);
  private readonly _authError = signal<boolean>(false);
  private readonly _unrecoverable = signal<boolean>(false);

  constructor(
    private origins: OriginStore,
  ) { }

  get debug() { return this._debug(); }
  set debug(value: boolean) { this._debug.set(value); }

  get tag() { return this._tag(); }
  set tag(value: string) { this._tag.set(value); }

  get origin() { return this._origin(); }
  set origin(value: string) { this._origin.set(value); }

  get access() { return this._access(); }
  set access(value: User | undefined) { this._access.set(value); }

  get ext() { return this._ext(); }
  set ext(value: Ext | undefined) { this._ext.set(value); }

  get defaultConfig() { return this._defaultConfig(); }
  set defaultConfig(value: UserConfig) { this._defaultConfig.set(value); }

  get ignoreNotifications() { return this._ignoreNotifications(); }
  set ignoreNotifications(value: number[]) { this._ignoreNotifications.set(value); }

  /**
   * Is admin.
   * Owns everything.
   * Limited to origin and sub origins.
   */
  get admin() { return this._admin(); }
  set admin(value: boolean) { this._admin.set(value); }

  /**
   * Is mod.
   * Owns everything except plugins and templates.
   * Limited to origin and sub origins.
   */
  get mod() { return this._mod(); }
  set mod(value: boolean) { this._mod.set(value); }

  /**
   * Is editor.
   * Allowed to toggle any public tag (except public and locked) to any Ref in view.
   * Limited to origin and sub origins.
   */
  get editor() { return this._editor(); }
  set editor(value: boolean) { this._editor.set(value); }

  /**
   * Is user.
   * Allowed to post Refs.
   * May be given access to other tags.
   * Limited to origin and sub origins.
   */
  get user() { return this._user(); }
  set user(value: boolean) { this._user.set(value); }

  /**
   * Is viewer.
   * Allowed to edit user ext.
   * May be given read access to other tags.
   * May not be given write access to other tags.
   * Limited to origin and sub origins.
   */
  get viewer() { return this._viewer(); }
  set viewer(value: boolean) { this._viewer.set(value); }

  /**
   * Is banned.
   * No access, ban message shown instead.
   * Limited to origin and sub origins.
   */
  get banned() { return this._banned(); }
  set banned(value: boolean) { this._banned.set(value); }

  /**
   * Unread inbox and alarms total count.
   */
  get notifications() { return this._notifications(); }
  set notifications(value: number) { this._notifications.set(value); }

  /**
   * Unread alarms count.
   */
  get alarmCount() { return this._alarmCount(); }
  set alarmCount(value: number) { this._alarmCount.set(value); }

  /**
   * Flag indicating the interceptor detected an unauthorized request.
   */
  get authError() { return this._authError(); }
  set authError(value: boolean) { this._authError.set(value); }

  /**
   * Flag indicating an unrecoverable error loading app from PWA cache.
   */
  get unrecoverable() { return this._unrecoverable(); }
  set unrecoverable(value: boolean) { this._unrecoverable.set(value); }

  private readonly _signedIn = computed(() => {
    return !!this.tag;
  });
  get signedIn() {
    return this._signedIn();
  }

  private readonly _root = computed(() => {
    return !this.origin;
  });
  get root() {
    return this._root();
  }

  private readonly _localTag = computed(() => {
    return localTag(this.tag);
  });
  get localTag() {
    return this._localTag();
  }

  private readonly _tagWithOrigin = computed(() => {
    return localTag(this.tag) + (this.origin || '@');
  });
  get tagWithOrigin() {
    return this._tagWithOrigin();
  }

  private readonly _userTag = computed(() => {
     if (hasPrefix(localTag(this.tag), 'user')) return this.localTag;
     return '';
  });
  get userTag() {
    return this._userTag();
  }

  private readonly _role = computed(() => {
    if (!this.signedIn) return '';
    if (this.admin) return 'admin';
    if (this.mod) return 'mod';
    if (this.editor) return 'editor';
    if (this.user) return 'user';
    if (this.viewer) return 'viewer';
    return 'anon';
  });
  get role() {
    return this._role();
  }

  private readonly _roles = computed((): Roles => {
    return {
      debug: this.debug,
      tag: this.tag,
      admin: this.admin,
      mod: this.mod,
      editor: this.editor,
      user: this.user,
      viewer: this.viewer,
      banned: this.banned,
    };
  });
  get roles(): Roles {
    return this._roles();
  }

  private readonly _config = computed((): UserConfig => {
    return {
      ...(this.defaultConfig || {}),
      ...(this.ext?.config || {}),
    };
  });
  get config(): UserConfig {
    return this._config();
  }

  private readonly _subs = computed((): string[] => {
    return this.config.subscriptions || defaultSubs;
  });
  get subs(): string[] {
    return this._subs();
  }

  private readonly _userSubs = computed((): string[] => {
    return this.subs.filter(s => hasPrefix(s, 'user'));
  });
  get userSubs(): string[] {
    return this._userSubs();
  }

  private readonly _tagSubs = computed((): string[] => {
    return this.subs.filter(s => !hasPrefix(s, 'user'));
  });
  get tagSubs(): string[] {
    return this._tagSubs();
  }

  private readonly _bookmarks = computed(() => {
    return this.config.bookmarks || [];
  });
  get bookmarks() {
    return this._bookmarks();
  }

  private readonly _bookmarkQueries = computed(() => {
    return this.bookmarks.map(b => b.includes('?') ? b.substring(0, b.indexOf('?')) : b);
  });
  get bookmarkQueries() {
    return this._bookmarkQueries();
  }

  private readonly _bookmarkParams = computed(() => {
    return this.bookmarks.map(b => parseBookmarkParams(b.includes('?') ? b.substring(b.indexOf('?')) : b));
  });
  get bookmarkParams() {
    return this._bookmarkParams();
  }

  private readonly _alarms = computed((): string[] => {
    return this.config.alarms || [];
  });
  get alarms(): string[] {
    return this._alarms();
  }

  private readonly _mailbox = computed(() => {
    if (!this.signedIn) return undefined;
    return getMailbox(this.tag, this.origin) + (this.origin || '@');
  });
  get mailbox() {
    return this._mailbox();
  }

  private readonly _modmail = computed(() => {
    return this.access?.readAccess?.filter(t => hasPrefix(t, 'plugin/inbox')).map(t => defaultOrigin(t, this.origin || '@'));
  });
  get modmail() {
    return this._modmail();
  }

  private readonly _outboxes = computed(() => {
    return Array.from(this.origins.reverseLookup)
      .map(([remote, localAlias]) => setPublic(prefix('plugin/outbox', localAlias, this.localTag)) + remote);
  });
  get outboxes() {
    return this._outboxes();
  }

  private readonly _inboxQuery = computed(() => {
    if (!this.signedIn) return '';
    let tags = [this.mailbox];
    if (this.origin) {
      tags.push(setPublic(prefix('plugin/outbox', this.origin, this.tagWithOrigin)) + this.origin);
    }
    if (this.modmail?.length) {
      tags.push(...this.modmail);
    }
    if (this.outboxes?.length) {
      tags.push(...this.outboxes);
    }
    return uniq(tags).join('|');
  });
  get inboxQuery() {
    return this._inboxQuery();
  }

  private readonly _notificationsQuery = computed(() => {
    if (!this.signedIn) return undefined;
    const alarms = this.alarmsQuery ? '|' + this.alarmsQuery : '';
    return `!${this.tag}:!plugin/delete:` + braces(this.inboxQuery) + alarms;
  });
  get notificationsQuery() {
    return this._notificationsQuery();
  }

  private readonly _alarmsQuery = computed(() => {
    if (!this.signedIn) return undefined;
    if (!this.config.alarms?.length) return '';
    return this.config.alarms.join('|');
  });
  get alarmsQuery() {
    return this._alarmsQuery();
  }

  private readonly _subscriptionQuery = computed(() => {
    if (!this.tagSubs.length) return 'none';
    return '!internal:(' + this.tagSubs.join('|') + ')';
  });
  get subscriptionQuery() {
    return this._subscriptionQuery();
  }

  querySymbol(...ops: ('/' | '{' | '}' | ',' | ':' | '|' | '(' | ')' | `!`)[]): string {
    return ops.map(op => {
      if (this.config.queryStyle === 'set') {
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
      if (this.config.queryStyle === 'logic') {
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
      if (this.config.queryStyle === 'code') {
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
    this.debug = roles.debug;
    this.origin = tagOrigin(roles.tag);
    this.tag = roles.tag || '';
    if (this.tag.startsWith('@')) {
      // Not logged in, only local origin is set
      this.tag = '';
    }
    this.admin = roles.admin;
    this.mod = roles.mod;
    this.editor = roles.editor;
    this.user = roles.user;
    this.viewer = roles.viewer;
    this.banned = roles.banned;
  }

  defaultEditors(plugins: string[]) {
    if (!this.config?.editors) return [];
    return intersection(this.config.editors, plugins);
  }
}
