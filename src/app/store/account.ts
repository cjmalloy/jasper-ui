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
    return this.user?.readAccess?.filter(t => hasPrefix(t, 'plugin/inbox'));
  }

  get outboxes() {
    return this.user?.readAccess?.filter(t => hasPrefix(t, 'plugin/outbox'));
  }

  get notificationsQuery() {
    if (!this.signedIn) return undefined;
    let result = this.mailbox;
    if (this.modmail?.length) {
      result += '|' + this.modmail!.join('|');
    }
    if (this.outboxes?.length) {
      result += '|' + this.outboxes!.join('|');
    }
    return result;
  }

  get subscriptionQuery() {
    if (!this.signedIn) return 'none';
    if (!this.subs.length) return 'none';
    return this.subs.join('|');
  }

  setRoles(roles: Roles) {
    this.tag = roles.tag;
    this.admin = roles.admin;
    this.mod = roles.mod;
    this.editor = roles.editor;
    this.poster = roles.user;
  }
}
