import { Injectable } from '@angular/core';
import { without } from 'lodash-es';
import { concat, last } from 'rxjs';
import { Ref } from '../model/ref';
import { Action, active, EmitAction, emitModels, EventAction, ResponseAction, TagAction } from '../model/tag';
import { Store } from '../store/store';
import { ExtService } from './api/ext.service';
import { RefService } from './api/ref.service';
import { TaggingService } from './api/tagging.service';

@Injectable({
  providedIn: 'root'
})
export class ActionService {

  constructor(
    private refs: RefService,
    private exts: ExtService,
    private tags: TaggingService,
    private store: Store,
  ) { }

  apply(a: Action, ref: Ref, repost?: Ref) {
    if ('tag' in a) {
      return this.tag(a, ref);
    }
    if ('response' in a) {
      return this.respond(a, ref);
    }
    if ('event' in a) {
      return this.event(a, ref, repost);
    }
    if ('emit' in a) {
      return this.emit(a, ref);
    }
    throw 'Invalid action';
  }

  event(a: EventAction, ref: Ref, repost?: Ref) {
    this.store.eventBus.fire(a.event, ref, repost);
  }

  emit(a: EmitAction, ref: Ref) {
    const models = emitModels(a, ref, this.store.account.localTag);
    const uploads = [
      ...models.ref.map(ref=>  this.refs.create(ref)),
      ...models.ext.map(ext => this.exts.create(ext)),
    ];
    concat(...uploads).pipe(last()).subscribe();
  }

  tag(a: TagAction, ref: Ref) {
    const on = active(ref, a);
    const patch = (on ? '-' : '') + a.tag;
    this.store.eventBus.runAndReload(this.tags.create(patch, ref.url, ref.origin), ref);
  }

  respond(a: ResponseAction, ref: Ref) {
    const on = active(ref, a);
    if (on) {
      ref.metadata ||= {};
      ref.metadata.userUrls ||= [];
      ref.metadata.userUrls = without(ref.metadata.userUrls, a.response);
      this.store.eventBus.runAndRefresh(this.tags.deleteResponse(a.response, ref.url), ref);
    } else {
      const clear = (a.clear || []).map(t => '-' + t);
      const tags = [
        ...clear,
        a.response,
      ];
      ref.metadata ||= {};
      ref.metadata.userUrls ||= [];
      ref.metadata.userUrls.push(a.response);
      ref.metadata.userUrls = without(ref.metadata.userUrls, ...clear);
      this.store.eventBus.runAndRefresh(this.tags.respond(tags, ref.url), ref);
    }
  }
}
