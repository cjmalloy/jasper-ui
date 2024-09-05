import { Injectable } from '@angular/core';
import { debounce, isArray, without } from 'lodash-es';
import { runInAction } from 'mobx';
import * as moment from 'moment';
import { catchError, concat, last, Observable, of, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PluginApi } from '../model/plugin';
import { Ref } from '../model/ref';
import { Action, EmitAction, emitModels } from '../model/tag';
import { Store } from '../store/store';
import { hasTag } from '../util/tag';
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

  wrap(ref?: Ref): PluginApi {
    let o: Subscription | undefined = undefined;
    return {
      comment: debounce((comment: string) => {
        if (!ref) throw 'Error: No ref to save';
        o?.unsubscribe();
        o = this.$comment(comment, ref).subscribe();
      }, 500),
      event: (event: string) => {
        this.event(event, ref);
      },
      emit: (a: EmitAction) => {
        this.emit(a, ref);
      },
      tag: (tag: string) => {
        if (!ref) throw 'Error: No ref to tag';
        this.tag(tag, ref);
      },
      respond: (response: string, clear?: string[]) => {
        if (!ref) throw 'Error: No ref to respond to';
        this.respond(response, clear || [], ref);
      }
    }
  }

  apply$(actions: Action | Action[], ref: Ref, repost?: Ref) {
    if (!isArray(actions)) actions = [actions];
    const updates: Observable<any>[] = [];
    for (const a of actions) {
      if ('tag' in a) {
        updates.push(this.$tag(a.tag, ref));
      }
      if ('response' in a) {
        updates.push(this.$respond(a.response, a.clear || [], ref));
      }
      if ('event' in a) {
        updates.push(this.$event(a.event, ref, repost));
      }
      if ('emit' in a) {
        updates.push(this.$emit(a, ref));
      }
    }
    if (!updates.length) throw 'Invalid action';
    return this.store.eventBus.runAndReload$(concat(...updates).pipe(last()), ref);
  }

  event(event: string, ref?: Ref, repost?: Ref) {
    this.store.eventBus.fire(event, ref, repost);
  }

  $event(event: string, ref?: Ref, repost?: Ref) {
    this.store.eventBus.fire(event, ref, repost);
    return of(null);
  }

  emit(a: EmitAction, ref?: Ref) {
    this.$emit(a, ref).subscribe();
  }

  $emit(a: EmitAction, ref?: Ref) {
    const models = emitModels(a, ref, this.store.account.localTag);
    const uploads = [
      ...models.ref.map(ref => this.refs.create(ref)),
      ...models.ext.map(ext => this.exts.create(ext)),
    ];
    return concat(...uploads).pipe(last());
  }

  comment(comment: string, ref: Ref) {
    this.store.eventBus.runAndRefresh(this.$comment(comment, ref), ref);
  }

  $comment(comment: string, ref: Ref) {
    return this.refs.patch(ref.url, ref.origin!, ref.modifiedString!, [{
      op: 'add',
      path: '/comment',
      value: comment,
    }]).pipe(
      catchError(err => {
        if (err.status === 409) {
          return this.refs.get(ref.url, ref.origin).pipe(
            switchMap(ref => this.refs.patch(ref.url, ref.origin!, ref.modifiedString!, [{
              op: 'add',
              path: '/comment',
              value: comment,
            }])),
          );
        }
        return throwError(() => err);
      }),
      tap(cursor => runInAction(() => {
        ref.comment = comment;
        ref.modifiedString = cursor;
        ref.modified = moment(cursor);
      })),
    );
  }

  tag(tag: string, ref: Ref) {
    this.store.eventBus.runAndReload(this.$tag(tag, ref), ref);
  }

  $tag(tag: string, ref: Ref) {
    const patch = (hasTag(tag, ref) ? '-' : '') + tag;
    return this.tags.create(patch, ref.url, ref.origin);
  }

  respond(response: string, clear: string[], ref: Ref) {
    this.store.eventBus.runAndRefresh(this.$respond(response, clear, ref), ref);
  }

  $respond(response: string, clear: string[], ref: Ref) {
    if (ref.metadata?.userUrls?.includes(response)) {
      ref.metadata ||= {};
      ref.metadata.userUrls ||= [];
      ref.metadata.userUrls = without(ref.metadata.userUrls, response);
      return this.tags.deleteResponse(response, ref.url);
    } else {
      const tags = [
        ...clear.map(t => '-' + t),
        response,
      ];
      ref.metadata ||= {};
      ref.metadata.userUrls ||= [];
      ref.metadata.userUrls.push(response);
      ref.metadata.userUrls = without(ref.metadata.userUrls, ...clear);
      return this.tags.respond(tags, ref.url);
    }
  }
}
