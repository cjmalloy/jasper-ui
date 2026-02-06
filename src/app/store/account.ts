import { signal } from '@angular/core';
import { intersection, uniq } from 'lodash-es';
import { Ext } from '../model/ext';
import { Roles, User } from '../model/user';
import { getMailbox } from '../mods/mailbox';
import { defaultSubs, UserConfig } from '../mods/user';
import { braces, defaultOrigin, hasPrefix, localTag, prefix, setPublic, tagOrigin } from '../util/tag';
import { OriginStore } from './origin';

export class AccountStore {

  private _debug = signal(false);
  private _tag = signal('');
  private _origin = signal('');
  private _access = signal<User | undefined>(undefined);
  private _ext = signal<Ext | undefined>(undefined);
  private _defaultConfig = signal<UserConfig>({});
  private _ignoreNotifications = signal<number[]>([]);
  private _admin = signal(false);
  private _mod = signal(false);
  private _editor = signal(false);
  private _user = signal(false);
  private _viewer = signal(false);
  private _banned = signal(false);
  private _notifications = signal(0);
  private _alarmCount = signal(0);
  private _authError = signal(false);
  private _unrecoverable = signal(false);

  constructor(
    private origins: OriginStore,
  ) {}

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

  get signedIn() {
    return !!this._tag();
  }

  get root() {
    return !this._origin();
  }

  get localTag() {
    return localTag(this._tag());
  }

  get tagWithOrigin() {
    return localTag(this._tag()) + (this._origin() || '@');
  }

  get userTag() {
     if (hasPrefix(localTag(this._tag()), 'user')) return this.localTag;
     return '';
  }

  get role() {
    if (!this.signedIn) return '';
    if (this._admin()) return 'admin';
    if (this._mod()) return 'mod';
    if (this._editor()) return 'editor';
    if (this._user()) return 'user';
    if (this._viewer()) return 'viewer';
    return 'anon';
  }

  get roles(): Roles {
    return {
      debug: this._debug(),
      tag: this._tag(),
      admin: this._admin(),
      mod: this._mod(),
      editor: this._editor(),
      user: this._user(),
      viewer: this._viewer(),
      banned: this._banned(),
    };
  }

  get config(): UserConfig {
    return {
      ...(this._defaultConfig() || {}),
      ...(this._ext()?.config || {}),
    };
  }

  get subs(): string[] {
    return this.config.subscriptions || defaultSubs;
  }

  get userSubs(): string[] {
    return this.subs.filter(s => hasPrefix(s, 'user'));
  }

  get tagSubs(): string[] {
    return this.subs.filter(s => !hasPrefix(s, 'user'));
  }

  get bookmarks() {
    return this.config.bookmarks || [];
  }

  get alarms(): string[] {
    return this.config.alarms || [];
  }

  get mailbox() {
    if (!this.signedIn) return undefined;
    return getMailbox(this._tag(), this._origin()) + (this._origin() || '@');
  }

  get modmail() {
    return this._access()?.readAccess?.filter(t => hasPrefix(t, 'plugin/inbox')).map(t => defaultOrigin(t, this._origin() || '@'));
  }

  get outboxes() {
    return Array.from(this.origins.reverseLookup)
      .map(([remote, localAlias]) => setPublic(prefix('plugin/outbox', localAlias, this.localTag)) + remote);
  }

  get inboxQuery() {
    if (!this.signedIn) return '';
    let tags = [this.mailbox];
    if (this._origin()) {
      tags.push(setPublic(prefix('plugin/outbox', this._origin(), this.tagWithOrigin)) + this._origin());
    }
    if (this.modmail?.length) {
      tags.push(...this.modmail);
    }
    if (this.outboxes?.length) {
      tags.push(...this.outboxes);
    }
    return uniq(tags).join('|');
  }

  get notificationsQuery() {
    if (!this.signedIn) return undefined;
    const alarms = this.alarmsQuery ? '|' + this.alarmsQuery : '';
    return `!${this._tag()}:!plugin/delete:` + braces(this.inboxQuery) + alarms;
  }

  get alarmsQuery() {
    if (!this.signedIn) return undefined;
    if (!this.config.alarms?.length) return '';
    return this.config.alarms.join('|');
  }

  get subscriptionQuery() {
    if (!this.tagSubs.length) return 'none';
    return '!internal:(' + this.tagSubs.join('|') + ')';
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
    this._debug.set(roles.debug);
    this._origin.set(tagOrigin(roles.tag));
    this._tag.set(roles.tag || '');
    if (this._tag().startsWith('@')) {
      // Not logged in, only local origin is set
      this._tag.set('');
    }
    this._admin.set(roles.admin);
    this._mod.set(roles.mod);
    this._editor.set(roles.editor);
    this._user.set(roles.user);
    this._viewer.set(roles.viewer);
    this._banned.set(roles.banned);
  }

  defaultEditors(plugins: string[]) {
    if (!this.config?.editors) return [];
    return intersection(this.config.editors, plugins);
  }
}
