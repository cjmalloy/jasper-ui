import { intersection, uniq } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import { Ext } from '../model/ext';
import { Roles, User } from '../model/user';
import { getMailbox } from '../mods/mailbox';
import { defaultSubs, UserConfig } from '../mods/user';
import { hasPrefix, localTag, prefix, tagOrigin } from '../util/tag';
import { OriginStore } from './origin';

export class AccountStore {

  debug = false;
  tag = '';
  origin = '';
  access?: User = {} as User;
  ext?: Ext = {} as Ext;
  defaultConfig: UserConfig = {};

  /**
   * Is admin.
   * Owns everything.
   * Limited to origin in multi-tenant.
   */
  admin = false;
  /**
   * Is mod.
   * Owns everything except plugins and templates.
   * Limited to origin in multi-tenant.
   */
  mod = false;
  /**
   * Is editor.
   * Allowed to toggle any public tag (except public and locked) to any Ref in view.
   * Limited to origin in multi-tenant.
   */
  editor = false;
  /**
   * Is user.
   * Allowed to post Refs.
   * May be given access to other tags.
   */
  user = false;
  /**
   * Is viewer.
   * Allowed to edit user ext.
   * May be given read access to other tags.
   * May not be given write access to other tags.
   */
  viewer = false;
  /**
   * Is banned.
   * No access, ban message shown instead.
   */
  banned = false;
  /**
   * Unread inbox and alarms total count.
   */
  notifications = 0;
  /**
   * Flag indicating the interceptor detected an unauthorized request.
   */
  authError = false;
  /**
   * Flag indicating an unrecoverable error loading app from PWA cache.
   */
  unrecoverable = false;

  constructor(
    private origins: OriginStore,
  ) {
    makeAutoObservable(this);
    // Initial observables may not be null for MobX
    this.access = undefined;
    this.ext = undefined;
    this.defaultConfig = {};
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
    return getMailbox(this.tag);
  }

  get modmail() {
    return this.access?.readAccess?.filter(t => hasPrefix(t, 'plugin/inbox')).map(t => t + (this.origin || '@*'));
  }

  get outboxes() {
    return Array.from(this.origins.reverseLookup)
      .map(([remote, localAlias]) => prefix('plugin/outbox', localAlias, this.localTag) + remote);
  }

  get inboxQuery() {
    if (!this.signedIn) return undefined;
    let tags = [this.mailbox];
    if (this.origin) {
      tags.push(prefix('plugin/outbox', this.origin, this.localTag));
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
    const alarms = this.config.alarms?.length ? '|' + this.config.alarms.join('|') : '';
    return `!${this.tag}:!plugin/delete:(` + this.inboxQuery + ')' + alarms;
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
        case `!`: return $localize` !`;
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
    if (!this.config?.editors) return plugins;
    return intersection(this.config.editors, plugins);
  }
}
