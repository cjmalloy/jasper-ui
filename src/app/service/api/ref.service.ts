import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { delay } from 'lodash-es';
import { autorun } from 'mobx';
import { catchError, concat, first, map, Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { mapPage, Page } from '../../model/page';
import { mapRef, Ref, RefFilter, RefPageArgs, writeEdit, writeRef } from '../../model/ref';
import { Store } from '../../store/store';
import { params } from '../../util/http';
import { escapePath, OpPatch } from '../../util/json-patch';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

export const REF_CACHE_MS = 15 * 60 * 1000;

@Injectable({
  providedIn: 'root',
})
export class RefService {

  private _cache = new Map<string, boolean>();

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private store: Store,
    private login: LoginService,
  ) {
    autorun(() => {
      if (this.store.eventBus.event === 'reload') {
        this.store.eventBus.catchError$(this.get(this.store.eventBus.ref!.url, this.store.eventBus.ref!.origin!))
          .subscribe(ref => this.store.eventBus.refresh(ref));
      }
    });
  }

  private get base() {
    return this.config.api + '/api/v1/ref';
  }

  create(ref: Ref): Observable<string> {
    return this.http.post<string>(this.base, writeRef(ref)).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  get(url: string, origin = ''): Observable<Ref> {
    return this.http.get(this.base, {
      params: params({ url, origin }),
    }).pipe(
      map(mapRef),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  getCurrent(url: string): Observable<Ref> {
    return this.page({ url, size: 1 }).pipe(
      map(page => {
        if (!page.content.length) throw { status: 404 };
        return page.content[0];
      }),
    );
  }

  getDefaults(...tags: string[]): Observable<{ url: string, ref: Partial<Ref> } | undefined> {
    return concat(...[
      ...tags.map(t => this.getCurrent('tag:/' + t).pipe(
        catchError(err => of()),
      )),
      of(undefined),
    ]).pipe(
      first(),
      map(ref => {
        if (!ref) return ref;
        const url = ref.url;
        const partial: Partial<Ref> = ref;
        delete partial.url;
        delete partial.origin;
        delete partial.modified;
        delete partial.modifiedString;
        delete partial.created;
        delete partial.published;
        return { url, ref: partial };
      })
    );
  }

  exists(url: string, origin?: string): Observable<boolean> {
    const key = (origin || '') + ':' + url;
    if (this._cache.has(key)) return of(this._cache.get(key)!);
    delay(() => this._cache.delete(key), REF_CACHE_MS);
    return this.count({ url, query: origin }).pipe(
      map(n => !!n),
      tap(e => this._cache.set(key, e)),
    );
  }

  page(args?: RefPageArgs): Observable<Page<Ref>> {
    if (args?.query === '!@*') return of(Page.of<Ref>([]));
    if (args && args.obsolete === undefined) {
      args.obsolete = false;
    }
    return this.http.get(`${this.base}/page`, {
      params: params(args),
    }).pipe(
      map(mapPage(mapRef)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  count(args?: RefFilter): Observable<number> {
    if (args && args.obsolete === undefined) {
      args.obsolete = false;
    }
    return this.http.get(`${this.base}/count`, {
      responseType: 'text',
      params: params(args),
    }).pipe(
      map(parseInt),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  update(ref: Ref): Observable<string> {
    return this.http.put<string>(this.base, writeRef(ref)).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  startEditing(ref: Ref) {
    return this.create({
      url: ref.url,
      origin: this.store.account.origin,
      tags: [this.store.account.localTag, 'plugin/editing'],
      plugins: { 'plugin/editing': writeEdit(ref) }
    });
  }

  saveEdit(ref: Ref, cursor?: string): Observable<string> {
    if (!cursor) return this.startEditing(ref);
    return this.patch(ref.url, this.store.account.origin, cursor, [{
      op: 'add',
      path: '/plugins/' + escapePath('plugin/editing'),
      value: writeEdit(ref),
    }]);
  }

  patch(url: string, origin: string, cursor: string, patch: OpPatch[]): Observable<string> {
    return this.http.patch<string>(this.base, patch, {
      headers: { 'Content-Type': 'application/json-patch+json' },
      params: params({ url, origin, cursor }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  merge(url: string, origin: string, cursor: string, patch: Partial<Ref>): Observable<string> {
    return this.http.patch<string>(this.base, patch, {
      headers: { 'Content-Type': 'application/merge-patch+json' },
      params: params({ url, origin, cursor }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  delete(url: string, origin = ''): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: params({ url, origin }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
