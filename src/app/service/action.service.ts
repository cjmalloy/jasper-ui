import { Injectable } from '@angular/core';
import { debounce, isArray, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { runInAction } from 'mobx';
import { catchError, concat, last, merge, mergeMap, Observable, of, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PluginApi } from '../model/plugin';
import { Ref } from '../model/ref';
import { Action, EmitAction, emitModels } from '../model/tag';
import { Store } from '../store/store';
import { merge3 } from '../util/diff';
import { hasTag } from '../util/tag';
import { ExtService } from './api/ext.service';
import { RefService } from './api/ref.service';
import { StompService } from './api/stomp.service';
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
    private stomp: StompService,
  ) { }

  wrap(ref?: Ref): PluginApi {
    let o: Subscription | undefined = undefined;
    return {
      comment: debounce((comment: string) => {
        if (!ref) throw 'Error: No ref to save';
        o?.unsubscribe();
        o = this.comment$(comment, ref).subscribe();
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
      },
      watch: (delimiter?: string) => {
        if (!ref) throw 'Error: No ref to respond to';
        return this.watch(ref, delimiter);
      },
      append: () => {
        if (!ref) throw 'Error: No ref to respond to';
        return this.append(ref);
      }
    }
  }

  apply$(actions: Action | Action[], ref: Ref, repost?: Ref) {
    if (!isArray(actions)) actions = [actions];
    const updates: Observable<any>[] = [];
    for (const a of actions) {
      if ('tag' in a) {
        updates.push(this.tag$(a.tag, ref));
      }
      if ('response' in a) {
        updates.push(this.respond$(a.response, a.clear || [], ref));
      }
      if ('event' in a) {
        updates.push(this.event$(a.event, ref, repost));
      }
      if ('emit' in a) {
        updates.push(this.emit$(a, ref));
      }
    }
    if (!updates.length) return of(null);
    return this.store.eventBus.runAndReload$(concat(...updates).pipe(last()), ref);
  }

  event(event: string, ref?: Ref, repost?: Ref) {
    this.store.eventBus.fire(event, ref, repost);
    this.store.eventBus.reset();
  }

  event$(event: string, ref?: Ref, repost?: Ref) {
    this.store.eventBus.fire(event, ref, repost);
    this.store.eventBus.reset();
    return of(null);
  }

  emit(a: EmitAction, ref?: Ref) {
    this.emit$(a, ref).subscribe();
  }

  emit$(a: EmitAction, ref?: Ref) {
    const models = emitModels(a, ref, this.store.account.localTag);
    const uploads = [
      ...models.ref.map(ref => this.refs.create(ref)),
      ...models.ext.map(ext => this.exts.create(ext)),
    ];
    return concat(...uploads).pipe(last());
  }

  comment(comment: string, ref: Ref) {
    this.store.eventBus.runAndRefresh(this.comment$(comment, ref), ref);
  }

  comment$(comment: string, ref: Ref) {
    return this.refs.patch(ref.url, this.store.account.origin, ref.modifiedString!, [{
      op: 'add',
      path: '/comment',
      value: comment,
    }]).pipe(
      catchError(err => {
        if (err.status === 409) {
          return this.refs.get(ref.url, this.store.account.origin).pipe(
            switchMap(ref => this.refs.patch(ref.url, this.store.account.origin, ref.modifiedString!, [{
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
    this.store.eventBus.runAndReload(this.tag$(tag, ref), ref);
  }

  tag$(tag: string, ref: Ref) {
    const patch = (hasTag(tag, ref) ? '-' : '') + tag;
    return this.tags.create(patch, ref.url, this.store.account.origin);
  }

  respond(response: string, clear: string[], ref: Ref) {
    this.store.eventBus.runAndRefresh(this.respond$(response, clear, ref), ref);
  }

  respond$(response: string, clear: string[], ref: Ref) {
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

  watch(ref: Ref, delimiter = '\n') {
    let cursor = ref.origin === this.store.account.origin ? ref.modifiedString! : '';
    let baseComment = ref.comment || '';
    const inner = {
      ref$: merge(...this.store.origins.list.map(origin => this.stomp.watchRef(ref.url, origin).pipe(
        tap(u => {
          if (u.origin === this.store.account.origin) cursor = u.modifiedString!;
          baseComment = u.comment || '';
        }),
      ))),
      comment$: (comment: string): Observable<string> => {
        if (!cursor) {
          return this.refs.get(ref.url, this.store.account.origin).pipe(
            tap(ref => {
              cursor = ref.modifiedString!;
              baseComment = ref.comment || '';
            }),
            switchMap(ref => inner.comment$(comment)),
          );
        }
        return this.refs.patch(ref.url, this.store.account.origin, cursor, [{
          op: 'add',
          path: '/comment',
          value: comment,
        }]).pipe(
          tap(c => {
            cursor = c;
            baseComment = comment;
          }),
          catchError(err => {
            if (err.status === 409) {
              // Fetch the current version from server
              return this.refs.get(ref.url, this.store.account.origin).pipe(
                switchMap(remote => {
                  const { mergedComment, conflict } = merge3(comment, baseComment, remote.comment || '', delimiter);
                  if (conflict) return throwError(() => ({ conflict }));
                  cursor = remote.modifiedString!;
                  baseComment = remote.comment || '';
                  return inner.comment$(mergedComment || '');
                }),
              );
            }
            return throwError(() => err);
          }),
        );
      },
    };
    return inner;
  }

  append(ref: Ref) {
    let cursor = ref.origin === this.store.account.origin ? ref.modifiedString! : '';
    let comment = ref.comment || '';
    let baseComment = ref.comment || '';
    const inner = {
      updates$: merge(...this.store.origins.list.map(origin => this.stomp.watchRef(ref.url, origin).pipe(
        tap(u => {
          if (u.origin === this.store.account.origin) cursor = u.modifiedString!;
          baseComment = u.comment || '';
        }),
        mergeMap(u => {
          if (comment.startsWith(u?.comment || '')) {
            return of();
          }
          if (!u.comment?.startsWith(comment)) {
            comment = u.comment || '';
            throw u;
          }
          const moves = u.comment.substring(comment.length).split('\n').map(m => m.trim()).filter(m => !!m);
          comment = comment ? `${comment}  \n${moves.join('  \n')}` : moves.join('  \n');
          return moves;
        })
      ))),
      append$: (value: string): Observable<string> => {
        if (!cursor) {
          return this.refs.get(ref.url, this.store.account.origin).pipe(
            tap(ref => {
              cursor = ref.modifiedString!;
              baseComment = ref.comment || '';
            }),
            switchMap(ref => inner.append$(value)),
          );
        }
        comment = comment ? `${comment}  \n${value}` : value;
        return this.refs.patch(ref.url, this.store.account.origin, cursor, [{
          op: 'add',
          path: '/comment',
          value: comment,
        }]).pipe(
          tap(c => {
            cursor = c;
            baseComment = comment;
          }),
        );
      },
    };
    return inner;
  }
}
