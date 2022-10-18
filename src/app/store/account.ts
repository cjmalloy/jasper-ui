import * as _ from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import { Ext } from '../model/ext';
import { Roles, User } from '../model/user';
import { getMailbox } from '../plugin/mailbox';
import { defaultSubs } from '../template/user';
import { hasPrefix } from '../util/tag';

export class AccountStore {

  tag = '';
  user?: User;
  ext?: Ext;
  admin = false;
  mod = false;
  editor = false;
  poster = false;
  notifications = 0;
  subs: string[] = defaultSubs;
  bookmarks: string[] = [];
  theme?: string;
  authError = false;

  constructor() {
    makeAutoObservable(this);
  }

  get signedIn() {
    return !!this.tag;
  }

  get localTag() {
    if (!this.tag.includes('@')) return this.tag;
    return this.tag.substring(0, this.tag.indexOf('@'));
  }

  get origin() {
    if (!this.tag.includes('@')) return '';
    return this.tag.substring(this.tag.indexOf('@'));
  }

  get role() {
    if (!this.signedIn) return '';
    if (this.admin) return 'admin';
    if (this.mod) return 'mod';
    if (this.editor) return 'editor';
    if (this.poster) return 'user';
    return 'viewer';
  }

  get mailbox() {
    if (!this.signedIn) return undefined;
    return getMailbox(this.tag);
  }

  get modmail() {
    return this.user?.readAccess?.filter(t => hasPrefix(t, 'plugin/inbox')).map(t => t + (this.origin || '@*'));
  }

  get outboxes() {
    return this.user?.readAccess?.filter(t => hasPrefix(t, 'plugin/outbox')).map(t => t + (this.origin || '@*'));
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
    return _.uniq(tags).join('|');
  }

  get subscriptionQuery() {
    if (!this.signedIn) return 'none';
    if (!this.subs.length) return 'none';
    return this.subs.join('|');
  }

  setRoles(roles: Roles) {
    this.tag = roles.tag || '';
    this.admin = roles.admin;
    this.mod = roles.mod;
    this.editor = roles.editor;
    this.poster = roles.user;
  }
}
