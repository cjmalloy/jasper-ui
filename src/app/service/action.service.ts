import { Injectable } from '@angular/core';
import { debounce, isArray, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { runInAction } from 'mobx';
import { catchError, concat, last, merge, Observable, of, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PluginApi } from '../model/plugin';
import { Ref, RefUpdates } from '../model/ref';
import { Action, EmitAction, emitModels } from '../model/tag';
import { Store } from '../store/store';
import { hasTag } from '../util/tag';
import { ExtService } from './api/ext.service';
import { RefService } from './api/ref.service';
import { StompService } from './api/stomp.service';
import { TaggingService } from './api/tagging.service';
import { AuthzService } from './authz.service';

export interface Watch {
  ref$: Observable<RefUpdates>;
  comment$: (comment: string) => Observable<string>;
}

@Injectable({
  providedIn: 'root'
})
export class ActionService {

  constructor(
    private refs: RefService,
    private exts: ExtService,
    private tags: TaggingService,
    private auth: AuthzService,
    private store: Store,
    private stomp: StompService,
  ) { }

  watch$(ref: Ref): Watch {
    // Get all origins to watch
    const origins = this.store.origins?.list || [this.store.account.origin];
    
    // Create observables for each origin and merge them
    const streams = origins.map(origin => 
      this.stomp.watchRefOnOrigin(ref.url, origin)
    );
    
    // Merge all origin streams to get ref updates
    const ref$ = merge(...streams);
    
    // Create the comment$ function that handles cursor management and conflicts
    const comment$ = (comment: string): Observable<string> => {
      return this.refs.patch(ref.url, this.store.account.origin, ref.modifiedString!, [{
        op: 'add',
        path: '/comment',
        value: comment,
      }]).pipe(
        catchError(err => {
          if (err.status === 409) {
            // Get fresh ref and retry
            return this.refs.get(ref.url, this.store.account.origin).pipe(
              switchMap(freshRef => {
                return this.refs.patch(freshRef.url, this.store.account.origin, freshRef.modifiedString!, [{
                  op: 'add',
                  path: '/comment',
                  value: comment,
                }]);
              })
            );
          }
          return throwError(() => err);
        })
      );
    };
    
    return { ref$, comment$ };
  }

  append$(ref: Ref, move: string): Observable<string> {
    // Append move to existing comment with space separator
    const currentComment = ref.comment || '';
    const newComment = currentComment ? `${currentComment} ${move}` : move;
    
    return this.refs.patch(ref.url, this.store.account.origin, ref.modifiedString!, [{
      op: 'add',
      path: '/comment',
      value: newComment,
    }]).pipe(
      catchError(err => {
        if (err.status === 409) {
          // Get fresh ref and retry with updated comment
          return this.refs.get(ref.url, this.store.account.origin).pipe(
            switchMap(freshRef => {
              const freshComment = freshRef.comment || '';
              const freshNewComment = freshComment ? `${freshComment} ${move}` : move;
              return this.refs.patch(freshRef.url, this.store.account.origin, freshRef.modifiedString!, [{
                op: 'add',
                path: '/comment',
                value: freshNewComment,
              }]);
            })
          );
        }
        return throwError(() => err);
      })
    );
  }

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
    if (!updates.length) return of(null);
    return this.store.eventBus.runAndReload$(concat(...updates).pipe(last()), ref);
  }

  event(event: string, ref?: Ref, repost?: Ref) {
    this.store.eventBus.fire(event, ref, repost);
    this.store.eventBus.reset();
  }

  $event(event: string, ref?: Ref, repost?: Ref) {
    this.store.eventBus.fire(event, ref, repost);
    this.store.eventBus.reset();
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
        ref.modified = DateTime.fromISO(cursor);
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
