import { computed, Injectable, signal } from '@angular/core';
import { intersection, uniq } from 'lodash-es';
import { Ext } from '../model/ext';
import { Roles, User } from '../model/user';
import { getMailbox } from '../mods/mailbox';
import { defaultSubs, UserConfig } from '../mods/user';
import { braces, defaultOrigin, hasPrefix, localTag, prefix, setPublic, tagOrigin } from '../util/tag';
import { OriginStore } from './origin';

@Injectable({ providedIn: 'root' })
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

  // Backwards compatible getters/setters
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
  
  get admin() { return this._admin(); }
  set admin(value: boolean) { this._admin.set(value); }
  
  get mod() { return this._mod(); }
  set mod(value: boolean) { this._mod.set(value); }
  
  get editor() { return this._editor(); }
  set editor(value: boolean) { this._editor.set(value); }
  
  get user() { return this._user(); }
  set user(value: boolean) { this._user.set(value); }
  
  get viewer() { return this._viewer(); }
  set viewer(value: boolean) { this._viewer.set(value); }
  
  get banned() { return this._banned(); }
  set banned(value: boolean) { this._banned.set(value); }
  
  get notifications() { return this._notifications(); }
  set notifications(value: number) { this._notifications.set(value); }
  
  get alarmCount() { return this._alarmCount(); }
  set alarmCount(value: number) { this._alarmCount.set(value); }
  
  get authError() { return this._authError(); }
  set authError(value: boolean) { this._authError.set(value); }
  
  get unrecoverable() { return this._unrecoverable(); }
  set unrecoverable(value: boolean) { this._unrecoverable.set(value); }

  // Signal-based API
  debug$ = computed(() => this._debug());
  tag$ = computed(() => this._tag());
  origin$ = computed(() => this._origin());
  access$ = computed(() => this._access());
  ext$ = computed(() => this._ext());
  defaultConfig$ = computed(() => this._defaultConfig());
  ignoreNotifications$ = computed(() => this._ignoreNotifications());
  admin$ = computed(() => this._admin());
  mod$ = computed(() => this._mod());
  editor$ = computed(() => this._editor());
  user$ = computed(() => this._user());
  viewer$ = computed(() => this._viewer());
  banned$ = computed(() => this._banned());
  notifications$ = computed(() => this._notifications());
  alarmCount$ = computed(() => this._alarmCount());
  authError$ = computed(() => this._authError());
  unrecoverable$ = computed(() => this._unrecoverable());

  constructor(
    private origins: OriginStore,
  ) {
    // Initial values already set via signals
  }

  get signedIn() {
    return !!this.tag;
  }

  get root() {
    return !this.origin;
  }

  get localTag() {
    return localTag(this.tag);
  }

  get tagWithOrigin() {
    return localTag(this.tag) + (this.origin || '@');
  }

  get userTag() {
     if (hasPrefix(localTag(this.tag), 'user')) return this.localTag;
     return '';
  }

  get role() {
    if (!this.signedIn) return '';
    if (this.admin) return 'admin';
    if (this.mod) return 'mod';
    if (this.editor) return 'editor';
    if (this.user) return 'user';
    if (this.viewer) return 'viewer';
    return 'anon';
  }

  get roles(): Roles {
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
  }

  get config(): UserConfig {
    return {
      ...(this.defaultConfig || {}),
      ...(this.ext?.config || {}),
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
    return getMailbox(this.tag, this.origin) + (this.origin || '@');
  }

  get modmail() {
    return this.access?.readAccess?.filter(t => hasPrefix(t, 'plugin/inbox')).map(t => defaultOrigin(t, this.origin || '@'));
  }

  get outboxes() {
    return Array.from(this.origins.reverseLookup)
      .map(([remote, localAlias]) => setPublic(prefix('plugin/outbox', localAlias, this.localTag)) + remote);
  }

  get inboxQuery() {
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
  }

  get notificationsQuery() {
    if (!this.signedIn) return undefined;
    const alarms = this.alarmsQuery ? '|' + this.alarmsQuery : '';
    return `!${this.tag}:!plugin/delete:` + braces(this.inboxQuery) + alarms;
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
    if (this.tag.startsWith('@')) {
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
