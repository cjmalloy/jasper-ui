import { intersection, uniq } from 'lodash-es';
import { action, computed, makeObservable, observable } from 'mobx';
import { Ext } from '../model/ext';
import { Roles, User } from '../model/user';
import { getMailbox } from '../mods/mailbox';
import { defaultSubs, UserConfig } from '../mods/user';
import { config } from '../service/config.service';
import { hasPrefix, localTag, prefix, tagOrigin } from '../util/tag';
import { OriginStore } from './origin';

export class AccountStore {

  @observable
  debug = false;
  @observable
  tag = '';
  @observable
  origin = '';
  @observable
  access?: User = {} as User;
  @observable
  ext?: Ext = {} as Ext;
  @observable
  defaultConfig: UserConfig = {};

  /**
   * Is Sysadmin.
   * Only used in multi-tenant to own all origins.
   * Equivalent to Admin in single tenant.
   */
  @observable
  sa = false;
  /**
   * Is admin.
   * Owns everything.
   * Limited to origin in multi-tenant.
   */
  @observable
  admin = false;
  /**
   * Is mod.
   * Owns everything except plugins and templates.
   * Limited to origin in multi-tenant.
   */
  @observable
  mod = false;
  /**
   * Is editor.
   * Allowed to toggle any public tag (except public and locked) to any Ref in view.
   * Limited to origin in multi-tenant.
   */
  @observable
  editor = false;
  /**
   * Is user.
   * Allowed to post Refs.
   * May be given access to other tags.
   */
  @observable
  user = false;
  /**
   * Is viewer.
   * Allowed to edit user ext.
   * May be given read access to other tags.
   * May not be given write access to other tags.
   */
  @observable
  viewer = false;
  /**
   * Is banned.
   * No access, ban message shown instead.
   */
  @observable
  banned = false;
  @observable
  notifications = 0;
  @observable
  authError = false;

  constructor(
    private origins: OriginStore,
  ) {
    makeObservable(this);
    // Initial observables may not be null for MobX
    this.access = undefined;
    this.ext = undefined;
    this.defaultConfig = {};
  }

  @computed
  get sysAdmin() {
    if (config().multiTenant) return this.sa;
    return this.admin;
  }

  @computed
  get sysMod() {
    if (config().multiTenant) return this.sa;
    return this.mod;
  }

  @computed
  get signedIn() {
    return !!this.tag;
  }

  @computed
  get localTag() {
    return localTag(this.tag);
  }

  @computed
  get userTag() {
     if (hasPrefix(localTag(this.tag), 'user')) return this.localTag;
     return '';
  }

  @computed
  get role() {
    if (!this.signedIn) return '';
    if (this.admin) return 'admin';
    if (this.mod) return 'mod';
    if (this.editor) return 'editor';
    if (this.user) return 'user';
    if (this.viewer) return 'viewer';
    return 'anon';
  }

  @computed
  get roles(): Roles {
    return {
      debug: this.debug,
      tag: this.tag,
      sysadmin: this.sa,
      admin: this.admin,
      mod: this.mod,
      editor: this.editor,
      user: this.user,
      viewer: this.viewer,
      banned: this.banned,
    };
  }

  @computed
  get config(): UserConfig {
    return {
      ...(this.defaultConfig || {}),
      ...(this.ext?.config || {}),
    };
  }

  @computed
  get subs(): string[] {
    return this.config.subscriptions || defaultSubs;
  }

  @computed
  get userSubs(): string[] {
    return this.subs.filter(s => hasPrefix(s, 'user'));
  }

  @computed
  get tagSubs(): string[] {
    return this.subs.filter(s => !hasPrefix(s, 'user'));
  }

  @computed
  get bookmarks() {
    return this.config.bookmarks || [];
  }

  @computed
  get alarms(): string[] {
    return this.config.alarms || [];
  }

  @computed
  get mailbox() {
    if (!this.signedIn) return undefined;
    return getMailbox(this.tag);
  }

  @computed
  get modmail() {
    return this.access?.readAccess?.filter(t => hasPrefix(t, 'plugin/inbox')).map(t => t + (this.origin || '@*'));
  }

  @computed
  get outboxes() {
    return Array.from(this.origins.reverseLookup)
      .map(([remote, localAlias]) => prefix('plugin/outbox', localAlias, this.localTag) + remote);
  }

  @computed
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

  @computed
  get notificationsQuery() {
    if (!this.signedIn) return undefined;
    const alarms = this.config.alarms?.length ? '|' + this.config.alarms.join('|') : '';
    return `!${this.tag}:!plugin/delete:(` + this.inboxQuery + ')' + alarms;
  }

  @computed
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

  @action
  setRoles(roles: Roles) {
    this.debug = roles.debug;
    this.origin = tagOrigin(roles.tag);
    this.tag = roles.tag || '';
    if (this.tag.startsWith('@')) {
      // Not logged in, only local origin is set
      this.tag = '';
    }
    this.sa = roles.sysadmin;
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
