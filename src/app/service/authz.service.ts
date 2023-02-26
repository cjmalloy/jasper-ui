import { Injectable } from '@angular/core';
import { Ref } from '../model/ref';
import { Role } from '../model/user';
import { Store } from '../store/store';
import {
  captures,
  capturesAny,
  hasTag,
  isOwner,
  isOwnerTag,
  localTag,
  privateTag,
  publicTag,
  qualifyTags
} from '../util/tag';

@Injectable({
  providedIn: 'root'
})
export class AuthzService {

  constructor(
    private store: Store,
  ) { }

  writeAccess(ref: Ref): boolean {
    if (!this.store.account.signedIn) return false;
    if (ref.origin !== this.store.account.origin) return false;
    if (this.store.account.mod) return true;
    if (hasTag('locked', ref)) return false;
    if (isOwnerTag(this.store.account.tag, ref)) return true;
    if (!this.store.account.access) return false;
    if (isOwner(this.store.account.access, ref)) return true;
    return !!capturesAny(this.store.account.access.writeAccess, qualifyTags(ref.tags, ref.origin));
  }

  queryReadAccess(query?: string): boolean {
    if (!this.store.account.signedIn) return false;
    if (!query) return false;
    for (const part of query.split(/[-|:!()\s]+/)) {
      if (part && !this.tagReadAccess(part)) return false;
    }
    return true;
  }

  canAddTag(tag?: string): boolean {
    if (!this.store.account.signedIn) return false;
    if (!tag) return false;
    tag = localTag(tag);
    if (publicTag(tag)) return true;
    if (this.store.account.mod) return true;
    if (captures(this.store.account.localTag, tag)) return true;
    if (!this.store.account.access) return false;
    if (capturesAny(this.store.account.access.tagReadAccess, [tag])) return true;
    return !!capturesAny(this.store.account.access.readAccess, [tag]);
  }

  tagReadAccess(tag?: string): boolean {
    if (!this.store.account.signedIn) return false;
    if (!tag) return false;
    tag = localTag(tag);
    if (!privateTag(tag)) return true;
    if (this.store.account.mod) return true;
    if (captures(this.store.account.localTag, tag)) return true;
    if (!this.store.account.access) return false;
    if (capturesAny(this.store.account.access.tagReadAccess, [tag])) return true;
    return !!capturesAny(this.store.account.access.readAccess, [tag]);
  }

  tagWriteAccess(tag?: string): boolean {
    if (!this.store.account.signedIn) return false;
    if (!tag) return false;
    tag = localTag(tag);
    if (tag === 'locked') return false;
    if (this.store.account.mod) return true;
    if (this.store.account.editor && !privateTag(tag)) return true;
    if (captures(this.store.account.localTag, tag)) return true;
    if (!this.store.account.access) return false;
    return !!capturesAny(this.store.account.access.tagWriteAccess, [tag]);
  }

  hasRole(role: Role) {
    switch(role) {
      case 'ROLE_SYSADMIN': return this.store.account.sa;
      case 'ROLE_ADMIN': return this.store.account.admin;
      case 'ROLE_MOD': return this.store.account.mod;
      case 'ROLE_EDITOR': return this.store.account.editor;
      case 'ROLE_USER': return this.store.account.user;
      case 'ROLE_VIEWER': return true;
      case 'ROLE_ANONYMOUS': return true;
    }
    return false;
  }
}
