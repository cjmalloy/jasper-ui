import { HttpEventType, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { reaction } from 'mobx';
import { concat, defer, filter, finalize, map, Observable, of, shareReplay, switchMap, tap, toArray } from 'rxjs';
import { Ref } from '../model/ref';
import { Store } from '../store/store';
import { cacheUrlId, refCacheIds, rewriteCacheIds } from '../util/cache';
import { ProxyService } from './api/proxy.service';
import { RefService } from './api/ref.service';

/**
 * Restores cache files from uploaded zips on a Ref by Ref basis.
 * Since cache IDs cannot be chosen when uploading, each cache file is
 * uploaded as a new cache entry and the Ref is rewritten to use the new
 * cache ID. The old to new cache ID mapping is remembered so that each
 * cache file is only uploaded once, even when Refs are uploaded one at a
 * time. Mappings are dropped once no Ref in the upload list refers to them.
 */
@Injectable({
  providedIn: 'root',
})
export class UploadCacheService {

  /**
   * Map of origin and old cache ID to new cache ID.
   */
  private ids = new Map<string, string>();
  /**
   * In flight uploads, keyed by origin and old cache ID.
   */
  private pending = new Map<string, Observable<string | undefined>>();

  constructor(
    private store: Store,
    private proxy: ProxyService,
    private refs: RefService,
  ) {
    reaction(() => this.store.submit.refs, refs => this.prune(refs));
  }

  /**
   * Upload any cache files referenced by this Ref and rewrite the Ref to use
   * the new cache IDs.
   */
  restore$(ref: Ref, origin: string): Observable<Ref> {
    const ids = refCacheIds(ref).filter(id => {
      const key = this.key(id, origin);
      return this.ids.has(key) || this.pending.has(key) || this.store.submit.cacheFiles.has(id);
    });
    if (!ids.length) return of(ref);
    return concat(...ids.map(id => defer(() => this.upload$(id, ref, origin)).pipe(
      map(newId => [id, newId] as [string, string | undefined]),
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

  private prune(refs: Ref[]) {
    const keep = new Set(refs.flatMap(refCacheIds));
    for (const key of [...this.ids.keys()]) {
      if (!keep.has(key.substring(key.lastIndexOf(' ') + 1))) this.ids.delete(key);
    }
  }

  private upload$(id: string, ref: Ref, origin: string): Observable<string | undefined> {
    const key = this.key(id, origin);
    if (this.ids.has(key)) return of(this.ids.get(key));
    if (this.pending.has(key)) return this.pending.get(key)!;
    const zipped = this.store.submit.cacheFiles.get(id)!;
    const upload$ = defer(() => zipped.async('blob')).pipe(
      switchMap(blob => this.proxy.save(new File([blob], this.fileName(id, ref), { type: this.mimeType(id, ref) }), origin)),
      filter(event => event.type === HttpEventType.Response),
      map(event => {
        const saved = (event as HttpResponse<Ref>).body!;
        return cacheUrlId(saved.url) || saved.plugins?.['_plugin/cache']?.id as string | undefined;
      }),
      tap(newId => {
        if (newId) this.ids.set(key, newId);
      }),
      finalize(() => this.pending.delete(key)),
      shareReplay(1),
    );
    this.pending.set(key, upload$);
    return upload$;
  }

  private fileName(id: string, ref: Ref): string {
    for (const r of [ref, ...this.store.submit.refs]) {
      if (cacheUrlId(r.url) === id && r.title) return r.title;
    }
    return id;
  }

  private mimeType(id: string, ref: Ref): string {
    for (const r of [ref, ...this.store.submit.refs]) {
      const cache = r.plugins?.['_plugin/cache'];
      if (cache?.id === id && cache.mimeType) return cache.mimeType;
    }
    return '';
  }
}
