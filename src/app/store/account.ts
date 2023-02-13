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

  tag = '';
  user?: User = {} as User;
  ext?: Ext = {} as Ext;
  defaultConfig: any = {};
  sa = false;
  admin = false;
  mod = false;
  editor = false;
  poster = false;
  viewer = false;
  notifications = 0;
  authError = false;

  constructor(
    private origins: OriginStore,
  ) {
    makeAutoObservable(this);
    // Initial observables may not be null for MobX
    this.user = undefined;
    this.ext = undefined;
    this.defaultConfig = undefined;
  }

  get sysadmin() {
    if (config().multiTenant)  return this.sa;
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

  get origin() {
    return tagOrigin(this.tag);
  }

  get role() {
    if (!this.signedIn) return '';
    if (this.admin) return 'admin';
    if (this.mod) return 'mod';
    if (this.editor) return 'editor';
    if (this.poster) return 'user';
    if (this.viewer) return 'viewer';
    return 'anon';
  }

  get config() {
    return {
      ...(this.defaultConfig || {}),
      ...(this.ext?.config || {}),
    };
  }

  get subs() {
    return this.config.subscriptions || defaultSubs;
  }

  get bookmarks() {
    return this.config.bookmarks || [];
  }

  get mailbox() {
    if (!this.signedIn) return undefined;
    return getMailbox(this.tag);
  }

  get modmail() {
    return this.user?.readAccess?.filter(t => hasPrefix(t, 'plugin/inbox')).map(t => t + (this.origin || '@*'));
  }

  get outboxes() {
    return Array.from(this.origins.reverseLookup)
      .map(([remote, localAlias]) => prefix('plugin/outbox', localAlias, this.localTag) + remote);
  }

  get notificationsQuery() {
    if (!this.signedIn) return undefined;
    let tags = [this.mailbox];
    if (this.modmail?.length) {
      tags.push(...this.modmail);
    }
    if (this.outboxes?.length) {
      tags.push(...this.outboxes);
    }
    return uniq(tags).join('|');
  }

  get subscriptionQuery() {
    if (!this.subs.length) return 'none';
    return this.subs.join('|');
  }

  setRoles(roles: Roles) {
    this.tag = roles.tag || '';
    this.sa = roles.sysadmin;
    this.admin = roles.admin;
    this.mod = roles.mod;
    this.editor = roles.editor;
    this.poster = roles.user;
    this.viewer = roles.viewer;
  }

  defaultEditors(plugins: string[]) {
    if (!this.config?.editors) return plugins;
    return intersection(this.config.editors, plugins);
  }
}
