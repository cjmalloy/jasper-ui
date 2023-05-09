import { intersection, uniq } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import { Ext } from '../model/ext';
import { Roles, User } from '../model/user';
import { getMailbox } from '../plugin/mailbox';
import { config } from '../service/config.service';
import { defaultSubs } from '../template/user';
import { hasPrefix, localTag, prefix, tagOrigin } from '../util/tag';
import { OriginStore } from './origin';

export class AccountStore {

  debug = false;
  tag = '';
  origin = '';
  access?: User = {} as User;
  ext?: Ext = {} as Ext;
  defaultConfig: any = {};

  /**
   * Is Sysadmin.
   * Only used in multi-tenant to own all origins.
   * Equivalent to Admin in single tenant.
   */
  sa = false;
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
  notifications = 0;
  authError = false;

  constructor(
    private origins: OriginStore,
  ) {
    makeAutoObservable(this);
    // Initial observables may not be null for MobX
    this.access = undefined;
    this.ext = undefined;
    this.defaultConfig = undefined;
  }

  get sysAdmin() {
    if (config().multiTenant) return this.sa;
    return this.admin;
  }

  get sysMod() {
    if (config().multiTenant) return this.sa;
    return this.mod;
  }

  get signedIn() {
    return !!this.tag;
  }

  get localTag() {
    return localTag(this.tag);
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

  get config() {
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

  get alarms() {
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

  get notificationsQuery() {
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
    if (this.config.alarms) {
      tags.push(...this.config.alarms)
    }
    return uniq(tags).join('|');
  }

  get subscriptionQuery() {
    if (!this.subs.length) return 'none';
    return this.subs.join('|');
  }

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
  }

  defaultEditors(plugins: string[]) {
    if (!this.config?.editors) return plugins;
    return intersection(this.config.editors, plugins);
  }
}
