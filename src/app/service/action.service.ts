import { Injectable } from '@angular/core';
import { debounce, without } from 'lodash-es';
import { runInAction } from 'mobx';
import * as moment from 'moment';
import { catchError, concat, last, Observable, Subscription, switchMap, throwError } from 'rxjs';
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
        o = this.comment(comment, ref).subscribe();
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

  apply(a: Action, ref: Ref, repost?: Ref) {
    if ('tag' in a) {
      return this.tag(a.tag, ref);
    }
    if ('response' in a) {
      return this.respond(a.response, a.clear || [], ref);
    }
    if ('event' in a) {
      return this.event(a.event, ref, repost);
    }
    if ('emit' in a) {
      return this.emit(a, ref);
    }
    throw 'Invalid action';
  }

  event(event: string, ref?: Ref, repost?: Ref) {
    this.store.eventBus.fire(event, ref, repost);
  }

  emit(a: EmitAction, ref?: Ref) {
    const models = emitModels(a, ref, this.store.account.localTag);
    const uploads = [
      ...models.ref.map(ref=>  this.refs.create(ref)),
      ...models.ext.map(ext => this.exts.create(ext)),
    ];
    concat(...uploads).pipe(last()).subscribe();
  }

  comment(comment: string, ref: Ref) {
    return this.store.eventBus.runAndRefresh$(this.refs.patch(ref.url, ref.origin!, ref.modifiedString!, [{
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
    ), ref);
  }

  tag(tag: string, ref: Ref) {
    const patch = (hasTag(tag, ref) ? '-' : '') + tag;
    this.store.eventBus.runAndReload(this.tags.create(patch, ref.url, ref.origin), ref);
  }

  respond(response: string, clear: string[], ref: Ref) {
    if (ref.metadata?.userUrls?.includes(response)) {
      ref.metadata ||= {};
      ref.metadata.userUrls ||= [];
      ref.metadata.userUrls = without(ref.metadata.userUrls, response);
      this.store.eventBus.runAndRefresh(this.tags.deleteResponse(response, ref.url), ref);
    } else {
      const tags = [
        ...clear.map(t => '-' + t),
        response,
      ];
      ref.metadata ||= {};
      ref.metadata.userUrls ||= [];
      ref.metadata.userUrls.push(response);
      ref.metadata.userUrls = without(ref.metadata.userUrls, ...clear);
      this.store.eventBus.runAndRefresh(this.tags.respond(tags, ref.url), ref);
    }
  }
}
