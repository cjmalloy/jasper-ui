import { Injectable } from '@angular/core';
import { Ref } from '../model/ref';
import { Store } from '../store/store';
import {
  captures,
  capturesAny,
  hasTag,
  isOwner,
  isOwnerTag,
  localTag,
  privateTag,
  qualifyTags,
  tagOrigin
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
    if (this.store.account.mod) return true;
    if (ref.origin !== this.store.account.origin) return false;
    if (hasTag('locked', ref)) return false;
    if (isOwnerTag(this.store.account.tag, ref)) return true;
    if (!this.store.account.user) return false;
    if (isOwner(this.store.account.user, ref)) return true;
    return capturesAny(this.store.account.user.writeAccess, qualifyTags(ref.tags, ref.origin));
  }

  queryReadAccess(query?: string): boolean {
    if (!this.store.account.signedIn) return false;
    if (!query) return false;
    for (const part of query.split(/[-|:!()\s]+/)) {
      if (part && !this.tagReadAccess(part)) return false;
    }
    return true;
  }

  tagReadAccess(tag?: string): boolean {
    if (!this.store.account.signedIn) return false;
    if (!tag) return false;
    tag = localTag(tag);
    if (!privateTag(tag)) return true;
    if (this.store.account.mod) return true;
    if (captures(this.store.account.localTag, tag)) return true;
    if (!this.store.account.user) return false;
    if (capturesAny(this.store.account.user.tagReadAccess, [tag])) return true;
    return capturesAny(this.store.account.user.readAccess, [tag]);
  }

  tagWriteAccess(tag?: string): boolean {
    if (!this.store.account.signedIn) return false;
    if (!tag) return false;
    tag = localTag(tag);
    if (tag === 'locked') return false;
    if (this.store.account.mod) return true;
    if (this.store.account.editor && !privateTag(tag)) return true;
    if (captures(this.store.account.localTag, tag)) return true;
    if (!this.store.account.user) return false;
    return capturesAny(this.store.account.user.tagWriteAccess, [tag]);
  }
}
