import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { delay } from 'lodash-es';
import { catchError, concat, map, Observable, of, shareReplay, Subject, switchMap, toArray } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ext, mapExt, writeExt } from '../../model/ext';
import { mapPage, Page } from '../../model/page';
import { latest, TagPageArgs, TagQueryArgs } from '../../model/tag';
import { Store } from '../../store/store';
import { params } from '../../util/http';
import { OpPatch } from '../../util/json-patch';
import { hasPrefix, isQuery, localTag, protectedTag, removePrefix, tagOrigin } from '../../util/tag';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

export const EXT_CACHE_MS = 15 * 60 * 1000;
export const EXT_BATCH_THROTTLE_MS = 50;
export const EXT_BATCH_SIZE = 50;

@Injectable({
  providedIn: 'root',
})
export class ExtService {

  private _cache = new Map<string, Observable<Ext>>();
  private _batchQueue: Array<{ key: string; tag: string; origin?: string; subject: Subject<Ext> }> = [];
  private _batchTimer?: any;

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
      tap(() => this.store.local.loadExt([...this._cache.keys()])),
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
    return this.page({ query: prefetch.map(setOrigin).join('|'), size: 1000 }).pipe(
      tap(batch => {
        for (const key of prefetch) {
          const [tag, defaultOrigin] = key.split(':');
          if (!this._cache.has(key)) {
            if (tag.includes('@')) {
              this._cache.set(key, of(
                batch.content.find(x => x.tag === localTag(tag) && x.origin === tagOrigin(tag))
                || this.defaultExt(tag)));
            } else if (defaultOrigin) {
              this._cache.set(key, of(
                batch.content.find(x => x.tag === tag && x.origin === this.store.account.origin)
                || batch.content.find(x => x.tag === tag && x.origin === defaultOrigin)
                || latest(batch.content).find(x => x.tag === tag)
                || this.defaultExt(tag)));
            } else {
              this._cache.set(key, of(
                batch.content.find(x => x.tag === tag && x.origin === this.store.account.origin)
                || latest(batch.content).find(x => x.tag === tag)
                || this.defaultExt(tag)));
            }
          }
        }
      }),
      switchMap(batch => (page + 1) * this.config.fetchBatch >= this.store.local.extPrefetch.length ? of(null) : this.loadExts$(page + 1)),
    );
  }

  create(ext: Ext): Observable<string> {
    return this.http.post<string>(this.base, writeExt(ext)).pipe(
      tap(() => this.clearCache(ext.tag, ext)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  get(tag: string): Observable<Ext> {
    return this.http.get(this.base, {
      params: params({ tag }),
    }).pipe(
      map(mapExt),
      tap(ext => {
        this.prefillCache(ext);
        this.store.local.loadExt([...this._cache.keys()]);
      }),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  prefillCache(ext: Ext) {
    const key1 = ext.tag + ext.origin + ':';
    const key2 = ext.tag + ':' + ext.origin;
    const value = of(ext);
    this._cache.set(key1, value);
    this._cache.set(key2, value);
    delay(() => {
      if (this._cache.get(key1) === value) this._cache.delete(key1);
      if (this._cache.get(key2) === value) this._cache.delete(key2);
    }, EXT_CACHE_MS);
  }

  private processBatch() {
    if (this._batchQueue.length === 0) return;

    // Take up to EXT_BATCH_SIZE items from the queue
    const batch = this._batchQueue.splice(0, EXT_BATCH_SIZE);

    // Build query string for all tags in the batch
    const queries: string[] = [];
    for (const item of batch) {
      const tag = localTag(item.tag);
      const origin = tagOrigin(item.tag);
      if (origin) {
        queries.push(tag + origin);
      } else if (item.origin !== undefined) {
        queries.push(tag + this.store.account.origin + '|' + tag + item.origin);
      } else {
        queries.push(tag + this.store.account.origin);
      }
    }

    // Fetch all exts in a single page request
    this.page({ query: queries.join('|'), size: EXT_BATCH_SIZE }).pipe(
      catchError(() => of(Page.of([])))
    ).subscribe(result => {
      // Process results for each item in the batch
      for (const item of batch) {
        const tag = localTag(item.tag);
        const origin = tagOrigin(item.tag) || item.origin;

        let ext: Ext | undefined;
        if (tagOrigin(item.tag)) {
          ext = result.content.find(x => x.tag === tag && x.origin === tagOrigin(item.tag));
        } else if (item.origin !== undefined) {
          ext = result.content.find(x => x.tag === tag && x.origin === this.store.account.origin)
            || result.content.find(x => x.tag === tag && x.origin === item.origin)
            || latest(result.content).find(x => x.tag === tag);
        } else {
          ext = result.content.find(x => x.tag === tag && x.origin === this.store.account.origin)
            || latest(result.content).find(x => x.tag === tag);
        }

        const resolvedExt = ext || this.defaultExt(item.tag, origin);

        // Update cache with the resolved ext using the same logic as prefillCache()
        this.prefillCache(resolvedExt);

        // Emit the result to the subject
        item.subject.next(resolvedExt);
        item.subject.complete();
      }

      this.store.local.loadExt([...this._cache.keys()]);
    });

    // If there are more items in the queue, schedule another batch
    if (this._batchQueue.length > 0) {
      this._batchTimer = setTimeout(() => this.processBatch(), EXT_BATCH_THROTTLE_MS);
    } else {
      this._batchTimer = undefined;
    }
  }

  getCachedExts(tags: string[], origin?: string): Observable<Ext[]> {
    if (!tags) return of([]);
    return concat(...tags.map(t => this.getCachedExt(t, origin))).pipe(toArray());
  }

  getCachedExt(tag: string, origin?: string) {
    const key = tag + ':' + (origin || '');

    // Return immediately if cached
    if (this._cache.has(key)) {
      return this._cache.get(key)!;
    }

    // For queries or empty tags, return default immediately
    if (!tag || isQuery(tag)) {
      const value = of(this.defaultExt(tag, origin));
      this._cache.set(key, value);
      this.store.local.loadExt([...this._cache.keys()]);
      return value;
    }

    // For uncached exts, use batching mechanism
    const subject = new Subject<Ext>();
    const value = subject.asObservable().pipe(
      shareReplay(1),
    );
    this._cache.set(key, value);

    // Add to batch queue
    this._batchQueue.push({ key, tag, origin, subject });

    // Schedule batch processing if not already scheduled
    if (!this._batchTimer) {
      this._batchTimer = setTimeout(() => this.processBatch(), EXT_BATCH_THROTTLE_MS);
    }

    // Set cache expiration
    delay(() => {
      if (this._cache.get(key) === value) this._cache.delete(key);
    }, EXT_CACHE_MS);

    this.store.local.loadExt([...this._cache.keys()]);
    return value;
  }

  defaultExt(tag: string, defaultOrigin = '', name = ''): Ext {
    const origin = tagOrigin(tag) || defaultOrigin || '';
    tag = localTag(tag);
    name = name || hasPrefix(tag, 'user') ? removePrefix(protectedTag(tag) ? tag.substring(1) : tag) : name;
    return { name, tag, origin };
  }

  clearCache(tag: string, ext?: Ext) {
    for (const key of this._cache.keys()) {
      if (key.startsWith(tag + ':') || key.startsWith(tag + '@')) this._cache.delete(key);
    }
    if (ext) this.prefillCache(ext);
  }

  page(args?: TagPageArgs): Observable<Page<Ext>> {
    return this.http.get(`${this.base}/page`, {
      params: params(args),
    }).pipe(
      map(mapPage(mapExt)),
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

  update(ext: Ext): Observable<string> {
    return this.http.put<string>(this.base, writeExt(ext)).pipe(
      tap(() => this.clearCache(ext.tag, ext)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  patch(tag: string, cursor: string, patch: OpPatch[]): Observable<string> {
    return this.http.patch<string>(this.base, patch, {
      headers: { 'Content-Type': 'application/json-patch+json' },
      params: params({ tag, cursor }),
    }).pipe(
      tap(() => this.clearCache(localTag(tag))),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  merge(tag: string, cursor: string, patch: Partial<Ext>): Observable<string> {
    return this.http.patch<string>(this.base, patch, {
      headers: { 'Content-Type': 'application/merge-patch+json' },
      params: params({ tag, cursor }),
    }).pipe(
      tap(() => this.clearCache(localTag(tag))),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  delete(tag: string): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: params({ tag }),
    }).pipe(
      tap(() => this.clearCache(localTag(tag))),
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
