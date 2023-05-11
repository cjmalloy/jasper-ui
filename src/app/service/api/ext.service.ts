import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { delay } from 'lodash-es';
import { catchError, forkJoin, map, Observable, of, shareReplay } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ext, mapTag, writeExt } from '../../model/ext';
import { mapPage, Page } from '../../model/page';
import { TagPageArgs, TagQueryArgs } from '../../model/tag';
import { params } from '../../util/http';
import { isQuery, localTag, tagOrigin } from '../../util/tag';
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
  ) { }

  private get base() {
    return this.config.api + '/api/v1/ext';
  }

  private get repl() {
    return this.config.api + '/api/v1/repl/ext';
  }

  create(ext: Ext): Observable<void> {
    return this.http.post<void>(this.base, writeExt(ext)).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  push(ext: Ext, origin = ''): Observable<void> {
    return this.http.post<void>(this.repl, [writeExt(ext)], {
      params: params({ origin }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  get(tag: string): Observable<Ext> {
    return this.http.get(this.base, {
      params: params({ tag }),
    }).pipe(
      map(mapTag),
      tap(ext => this._cache.set(tag, of(ext))),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  getCachedExts(tags: string[]) {
    return forkJoin(tags.map(t => this.getCachedExt(t)));
  }

  getCachedExt(tag: string) {
    if (!this._cache.has(tag)) {
      if (isQuery(tag)) {
        this._cache.set(tag, of({ tag: tag, origin: "" } as Ext))
      } else {
        this._cache.set(tag, this.get(tag).pipe(
          catchError(err => of({ tag: localTag(tag), origin: tagOrigin(tag) } as Ext)),
          shareReplay(1),
        ));
        delay(() => this._cache.delete(tag), EXT_CACHE_MS);
      }
    }
    return this._cache.get(tag)!;
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

  update(ext: Ext): Observable<void> {
    return this.http.put<void>(this.base, writeExt(ext)).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  patch(tag: string, patch: any[]): Observable<void> {
    return this.http.patch<void>(this.base, patch, {
      headers: { 'Content-Type': 'application/json-patch+json' },
      params: params({ tag }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  delete(tag: string): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: params({ tag }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
