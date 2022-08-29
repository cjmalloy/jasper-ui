import { makeAutoObservable } from 'mobx';
import { Ext } from '../model/ext';
import { Roles, User } from '../model/user';
import { getInbox } from '../plugin/inbox';
import { defaultSubs } from '../template/user';
import { hasPrefix } from '../util/tag';

export class AccountStore {

  tag = '';
  permissions?: User;
  ext?: Ext;
  admin = false;
  mod = false;
  editor = false;
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
    if (this.permissions) return 'user';
    return 'viewer';
  }

  get inbox() {
    if (!this.signedIn) return undefined;
    return getInbox(this.tag);
  }

  get modmail() {
    return this.permissions?.readAccess?.filter(t => hasPrefix(t, 'plugin/inbox'));
  }

  get notificationsQuery() {
    if (!this.signedIn) return undefined;
    if (!this.modmail?.length) return this.inbox;
    return this.inbox + '|' + this.modmail!.join('|');
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
  }
}
