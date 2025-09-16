import { intersection, uniq } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import { Ext } from '../model/ext';
import { Roles, User } from '../model/user';
import { getMailbox } from '../mods/mailbox';
import { defaultSubs, UserConfig } from '../mods/user';
import { braces, defaultOrigin, hasPrefix, localTag, prefix, setPublic, tagOrigin } from '../util/tag';
import { OriginStore } from './origin';

export class AccountStore {

  debug = false;
  tag = '';
  origin = '';
  access?: User = {} as User;
  ext?: Ext = {} as Ext;
  defaultConfig: UserConfig = {};
  ignoreNotifications: number[] = [];
  
  /**
   * Original roles from whoAmI call before any User-Tag header changes
   */
  originalRoles?: Roles;
  
  /**
   * Selected user sub tag for the User-Tag header
   */
  selectedUserTag = '';

  /**
   * Is admin.
   * Owns everything.
   * Limited to origin and sub origins.
   */
  admin = false;
  /**
   * Is mod.
   * Owns everything except plugins and templates.
   * Limited to origin and sub origins.
   */
  mod = false;
  /**
   * Is editor.
   * Allowed to toggle any public tag (except public and locked) to any Ref in view.
   * Limited to origin and sub origins.
   */
  editor = false;
  /**
   * Is user.
   * Allowed to post Refs.
   * May be given access to other tags.
   * Limited to origin and sub origins.
   */
  user = false;
  /**
   * Is viewer.
   * Allowed to edit user ext.
   * May be given read access to other tags.
   * May not be given write access to other tags.
   * Limited to origin and sub origins.
   */
  viewer = false;
  /**
   * Is banned.
   * No access, ban message shown instead.
   * Limited to origin and sub origins.
   */
  banned = false;
  /**
   * Unread inbox and alarms total count.
   */
  notifications = 0;
  /**
   * Unread alarms count.
   */
  alarmCount = 0;
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
    // Save original roles on first call
    if (!this.originalRoles) {
      this.originalRoles = roles;
    }
    
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

  /**
   * Get the current user tag to use in the User-Tag header
   */
  get currentUserTag(): string {
    if (this.selectedUserTag && this.isValidSubTag(this.selectedUserTag)) {
      return this.selectedUserTag;
    }
    // Fall back to the original authenticated user tag
    return this.originalRoles?.tag || this.tag || '';
  }

  /**
   * Set the selected user tag
   */
  setSelectedUserTag(tag: string) {
    if (this.isValidSubTag(tag)) {
      this.selectedUserTag = tag;
    } else {
      throw new Error('Invalid sub tag: ' + tag);
    }
  }

  /**
   * Clear the selected tag (fall back to original authenticated user tag)
   */
  clearSelectedUserTag() {
    this.selectedUserTag = '';
  }

  /**
   * Check if a tag is a valid sub tag of the original authenticated user
   */
  isValidSubTag(tag: string): boolean {
    if (!tag) return false;
    if (!this.signedIn) return false;
    
    const originalUserTag = this.originalRoles?.tag || this.tag;
    if (!originalUserTag) return false;

    // The tag must be the same as original user tag or a sub tag of it
    return tag === originalUserTag || hasPrefix(tag, originalUserTag);
  }

  /**
   * Get all possible sub tags for the current user
   */
  getPossibleSubTags(): string[] {
    if (!this.signedIn) return [];
    
    const baseTag = this.originalRoles?.tag || this.tag;
    if (!baseTag) return [];

    // Start with the base tag itself
    const subTags = [baseTag];
    
    // Add some common sub tag patterns that users might want to use
    const commonSuffixes = ['admin', 'work', 'personal', 'bot', 'test', 'backup', 'support'];
    for (const suffix of commonSuffixes) {
      subTags.push(`${baseTag}/${suffix}`);
    }

    return subTags;
  }

  /**
   * Create a custom sub tag
   */
  createCustomSubTag(suffix: string): string {
    if (!this.signedIn) return '';
    
    const baseTag = this.originalRoles?.tag || this.tag;
    if (!baseTag) return '';
    
    // Clean the suffix - remove any invalid characters
    const cleanSuffix = suffix.replace(/[^a-z0-9.-]/gi, '').toLowerCase();
    if (!cleanSuffix) return '';
    
    return `${baseTag}/${cleanSuffix}`;
  }

  defaultEditors(plugins: string[]) {
    if (!this.config?.editors) return [];
    return intersection(this.config.editors, plugins);
  }
}
