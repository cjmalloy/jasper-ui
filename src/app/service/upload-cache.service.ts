import { HttpEventType, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, concat, filter, from, map, Observable, of, shareReplay, switchMap, throwError, toArray } from 'rxjs';
import { Ref } from '../model/ref';
import { Store } from '../store/store';
import { cacheUrlId, refCacheIds, rewriteCacheIds } from '../util/cache';
import { ProxyService } from './api/proxy.service';
import { RefService } from './api/ref.service';

/**
 * Restores cache files from uploaded zips on a Ref by Ref basis.
 * Since cache IDs cannot be chosen when uploading, each cache file is
 * uploaded as a new cache entry and the Ref is rewritten to use the new
 * cache ID. Uploaded cache files are tracked so that each one is only
 * uploaded once, even when Refs are uploaded one at a time.
 */
@Injectable({
  providedIn: 'root',
})
export class UploadCacheService {

  private uploaded = new Map<string, Observable<Ref>>();

  constructor(
    private store: Store,
    private proxy: ProxyService,
    private refs: RefService,
  ) { }

  /**
   * Upload any cache files referenced by this Ref and rewrite the Ref to use
   * the new cache IDs.
   */
  restore$(ref: Ref, origin: string): Observable<Ref> {
    const ids = refCacheIds(ref).filter(id => this.uploaded.has(this.key(id, origin)) || this.store.submit.cacheFiles.has(id));
    if (!ids.length) return of(ref);
    return concat(...ids.map(id => this.upload$(id, ref, origin).pipe(
      map(saved => [id, cacheUrlId(saved.url) || saved.plugins?.['_plugin/cache']?.id] as [string, string | undefined]),
    ))).pipe(
      toArray(),
      map(entries => new Map(entries.filter(([, newId]) => !!newId) as [string, string][])),
      switchMap(mapping => {
        const result = rewriteCacheIds(ref, mapping);
        const oldId = cacheUrlId(ref.url);
        if (!oldId || !mapping.has(oldId)) return of(result);
        // The Ref URL was rewritten to the newly created cache Ref
        return this.refs.get(result.url, origin).pipe(
          map(existing => {
            result.exists = true;
            result.modifiedString = existing.modifiedString;
            result.modified = existing.modified;
            if (existing.plugins?.['_plugin/cache']) {
              result.plugins = { ...result.plugins, '_plugin/cache': existing.plugins['_plugin/cache'] };
            }
            return result;
          }),
        );
      }),
    );
  }

  private key(id: string, origin: string) {
    return origin + ' ' + id;
  }

  private upload$(id: string, ref: Ref, origin: string): Observable<Ref> {
    const key = this.key(id, origin);
    if (this.uploaded.has(key)) return this.uploaded.get(key)!;
    const zipped = this.store.submit.cacheFiles.get(id)!;
    const name = cacheUrlId(ref.url) === id && ref.title || id;
    const upload$ = from(zipped.async('blob')).pipe(
      switchMap(blob => this.proxy.save(new File([blob], name, { type: this.mimeType(id, ref) }), origin)),
      filter(event => event.type === HttpEventType.Response),
      map(event => (event as HttpResponse<Ref>).body!),
      catchError(err => {
        this.uploaded.delete(key);
        return throwError(() => err);
      }),
      shareReplay(1),
    );
    this.uploaded.set(key, upload$);
    return upload$;
  }

  private mimeType(id: string, ref: Ref): string {
    for (const r of [ref, ...this.store.submit.refs]) {
      const cache = r.plugins?.['_plugin/cache'];
      if (cache?.id === id && cache.mimeType) return cache.mimeType;
    }
    return '';
  }
}
