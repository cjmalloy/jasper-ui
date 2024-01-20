import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { delay } from 'lodash-es';
import { catchError, concat, map, Observable, of, shareReplay, switchMap, throwError, toArray } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ext, mapTag, writeExt } from '../../model/ext';
import { mapPage, Page } from '../../model/page';
import { TagPageArgs, TagQueryArgs } from '../../model/tag';
import { Store } from '../../store/store';
import { params } from '../../util/http';
import { defaultOrigin, isQuery, localTag, tagOrigin } from '../../util/tag';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

export const EXT_CACHE_MS = 15 * 60 * 1000;

@Injectable({
  providedIn: 'root',
})
export class ExtService {

  private _cache = new Map<string, Observable<Ext>>();

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private login: LoginService,
    private store: Store,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/ext';
  }

  get init$() {
    return this.loadExts$().pipe(
      catchError(() => of(null)),
    );
  }

  private loadExts$(page = 0): Observable<null> {
    const alreadyLoaded = page * this.config.fetchBatch;
    if (alreadyLoaded >= this.config.maxExts) {
      console.error(`Too many exts to prefetch, only loaded ${alreadyLoaded}. Increase maxExts to load more.`)
      return of(null);
    }
    const prefetch = this.store.local.extPrefetch.slice(page * this.config.fetchBatch, (page + 1) * this.config.fetchBatch);
    const setOrigin = (t: string) => {
      const [tag, origin] = t.split(':');
      if (tag.includes('@')) return tag;
      if ((origin || '') !== this.store.account.origin) {
        return tag + (origin || '') + '|' + tag + this.store.account.origin;
      }
      return tag + this.store.account.origin;
    };
    return this.page({query: prefetch.map(setOrigin).join('|'), size: this.config.fetchBatch * 2}).pipe(
      tap(batch => {
        for (const ext of batch.content) {
          if (ext.origin === this.store.account.origin) {
            for (const key of prefetch) {
              const [tag, origin] = key.split(':');
              if (localTag(tag) !== ext.tag) continue;
              if (tag.includes('@') && tagOrigin(tag) !== this.store.account.origin) continue;
              this._cache.set(key, of(ext));
              console.log('loadExts$:', this.store.account.origin, 'adding', key);
              delay(() => this._cache.delete(key), EXT_CACHE_MS);
            }
          } else {
            this._cache.set(ext.tag + ext.origin + ':', of(ext));
            console.log('loadExts$: adding', ext.tag + ext.origin);
            delay(() => this._cache.delete(ext.tag + ext.origin + ':'), EXT_CACHE_MS);
          }
        }
        for (const key of prefetch) {
          const [tag, origin] = key.split(':');
          if (!this._cache.has(key)) {
            if (tag.includes('@')) {
              this._cache.set(key, of({ tag: localTag(tag), origin: tagOrigin(tag) } as Ext));
            } else {
              this._cache.set(key, of(batch.content.find(x => x.tag === tag) || { tag: localTag(tag), origin: tagOrigin(tag) } as Ext));
            }
          }
        }
      }),
      switchMap(batch => (page + 1) * this.config.fetchBatch >= this.store.local.extPrefetch.length ? of(null) : this.loadExts$(page + 1)),
    );
  }

  create(ext: Ext, force = false): Observable<string> {
    return this.http.post<string>(this.base, writeExt(ext), {
      params: !force ? undefined : { force: true },
    }).pipe(
      tap(() => this._cache.delete(ext.tag)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  get(tag: string): Observable<Ext> {
    return this.http.get(this.base, {
      params: params({ tag }),
    }).pipe(
      map(mapTag),
      tap(ext => {
        this._cache.set(tag, of(ext));
        this.store.local.loadExt([...this._cache.keys()]);
      }),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  getCachedExts(tags: string[], origin?: string): Observable<Ext[]> {
    if (!tags) return of([]);
    return concat(...tags.map(t => this.getCachedExt(t, origin))).pipe(toArray());
  }

  getCachedExt(tag: string, origin?: string) {
    if (tag.endsWith('undefined')) {
      console.log('gotcha');
    }
    const key = tag + ':' + (origin || '');
    if (!this._cache.has(key)) {
      if (isQuery(tag)) {
        this._cache.set(key, of({ name: tag, tag: tag, origin: origin } as Ext));
      } else {
        this._cache.set(key, this.get(defaultOrigin(tag, this.store.account.origin)).pipe(
          catchError(err => {
            if (origin === undefined) throw throwError(() => err);
            return this.get(defaultOrigin(tag, origin));
          }),
          catchError(err => {
            if (tag.includes('@')) throw throwError(() => err);
            return this.page({ query: localTag(tag), sort: ['levels,ASC', 'modified,DESC'] }).pipe(
              map(p => p.content.filter(x => x.tag === localTag(tag))[0])
            );
          }),
          catchError(err => of(null)),
          map(x => x ? x : { tag: localTag(tag), origin: tagOrigin(tag) || origin || '' } as Ext),
          tap(x => {
            this._cache.set(x.tag + x.origin + ':', of(x));
            this.store.local.loadExt([...this._cache.keys()]);
          }),
          shareReplay(1),
        ));
        console.log('getCachedExt: adding', key);
        delay(() => this._cache.delete(key), EXT_CACHE_MS);
      }
      this.store.local.loadExt([...this._cache.keys()]);
    }
    return this._cache.get(key)!;
  }

  page(args?: TagPageArgs): Observable<Page<Ext>> {
    return this.http.get(`${this.base}/page`, {
      params: params(args),
    }).pipe(
      map(mapPage(mapTag)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  count(args?: TagQueryArgs): Observable<number> {
    return this.http.get(`${this.base}/count`, {
      responseType: 'text',
      params: params(args),
    }).pipe(
      map(parseInt),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  update(ext: Ext, force = false): Observable<string> {
    return this.http.put<string>(this.base, writeExt(ext), {
      params: !force ? undefined : { force: true },
    }).pipe(
      tap(() => this._cache.delete(ext.tag)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  patch(tag: string, cursor: string, patch: any[]): Observable<string> {
    return this.http.patch<string>(this.base, patch, {
      headers: { 'Content-Type': 'application/json-patch+json' },
      params: params({ tag, cursor }),
    }).pipe(
      tap(() => this._cache.delete(tag)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  merge(tag: string, cursor: string, patch: Partial<Ext>): Observable<string> {
    return this.http.patch<string>(this.base, patch, {
      headers: { 'Content-Type': 'application/merge-patch+json' },
      params: params({ tag, cursor }),
    }).pipe(
      tap(() => this._cache.delete(tag)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  delete(tag: string): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: params({ tag }),
    }).pipe(
      tap(() => this._cache.delete(tag)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
