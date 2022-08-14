import { Injectable } from '@angular/core';
import { Ref } from '../model/ref';
import { Store } from '../store/store';
import { capturesAny, hasTag, isOwner, isOwnerTag, publicTag, qualifyTags } from '../util/tag';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(
    private store: Store,
  ) { }

  writeAccess(ref: Ref): boolean {
    if (!this.store.account.signedIn) return false;
    if (this.store.account.mod) return true;
    if (ref.origin) return false;
    if (hasTag('locked', ref)) return false;
    if (isOwnerTag(this.store.account.tag, ref)) return true;
    if (!this.store.account.user) return false;
    if (isOwner(this.store.account.user, ref)) return true;
    return capturesAny(this.store.account.user.writeAccess, qualifyTags(ref.tags, ref.origin));
  }

  tagReadAccess(tag: string): boolean {
    if (!this.store.account.signedIn) return false;
    if (!tag) return false;
    if (!tag.endsWith('@*') && tag.includes('@')) return false;
    if (publicTag(tag)) return true;
    if (this.store.account.mod) return true;
    if (!this.store.account.user) return false;
    if (tag === this.store.account.user.tag) return true;
    if (capturesAny(this.store.account.user.tagReadAccess, [tag])) return true;
    return capturesAny(this.store.account.user.tagReadAccess, [tag]);
  }

  tagWriteAccess(tag: string, type = 'ext'): boolean {
    if (!this.store.account.signedIn) return false;
    if (type === 'plugin' || type === 'template')  {
      return this.store.account.admin;
    }
    if (!tag) return false;
    if (!tag.endsWith('@*') && tag.includes('@')) return false;
    if (tag === 'locked') return false;
    if (this.store.account.editor && publicTag(tag)) return true;
    if (this.store.account.mod) return true;
    if (!this.store.account.user) return false;
    if (tag === this.store.account.user.tag) return true;
    return capturesAny(this.store.account.user.tagWriteAccess, [tag]);
  }
}
