import { Injectable } from '@angular/core';
import { HasTags } from '../model/tag';
import { Store } from '../store/store';
import { capturesAny, isOwner, isOwnerTag, publicTag, qualifyTags } from '../util/tag';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(
    private store: Store,
  ) { }

  writeAccess(ref: HasTags): boolean {
    if (!this.store.account.signedIn) return false;
    if (ref.origin) return false;
    if (this.store.account.mod) return true;
    if (ref.tags?.includes('locked')) return false;
    if (isOwnerTag(this.store.account.tag!, ref)) return true;
    if (isOwner(this.store.account.user!, ref)) return true;
    return capturesAny(this.store.account.user!.writeAccess, qualifyTags(ref.tags, ref.origin));
  }

  tagWriteAccess(tag: string, type = 'ext'): boolean {
    if (!this.store.account.signedIn) return false;
    if (type === 'plugin' || type === 'template')  {
      return this.store.account.admin;
    }
    if (!tag) return false;
    if (!tag.endsWith('@*') && tag.includes('@')) return false;
    if (!this.store.account.signedIn) return false;
    if (tag === 'locked') return false;
    if (this.store.account.editor && publicTag(tag)) return true;
    if (this.store.account.mod) return true;
    if (tag === this.store.account.user!.tag) return true;
    return capturesAny(this.store.account.user!.tagWriteAccess, [tag]);
  }
}
