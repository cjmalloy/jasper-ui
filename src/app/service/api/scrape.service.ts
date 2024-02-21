import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { autorun } from 'mobx';
import { catchError, map, Observable, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { mapRef, Ref } from '../../model/ref';
import { catchAll } from '../../mods/scrape';
import { Store } from '../../store/store';
import { params } from '../../util/http';
import { hasTag } from '../../util/tag';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';
import { RefService } from './ref.service';

@Injectable({
  providedIn: 'root',
})
export class ScrapeService {

  private cacheList = new Set<string>();

  private scraping: string[] = [];

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private store: Store,
    private refs: RefService,
    private login: LoginService,
  ) {
    autorun(() => {
      if (this.store.eventBus.event === 'scrape') {
        if (hasTag('+plugin/feed', this.store.eventBus.ref)) {
          this.store.eventBus.runAndReload(this.feed(this.store.eventBus.ref!.url, this.store.eventBus.ref!.origin));
        } else if (hasTag('_plugin/cache', this.store.eventBus.ref)) {
          this.store.eventBus.runAndReload(this.refresh(this.store.eventBus.ref!.url));
        }
      }
      if (this.store.eventBus.event === '+plugin/scrape:defaults') {
        this.defaults().subscribe();
      }
      if (store.eventBus.event === '+plugin/scrape:clear-cache') {
        this.clearConfigCache().subscribe();
      }
      if (store.eventBus.event === '_plugin/cache:clear-cache') {
        this.clearDeleted().subscribe();
      }
    });
  }

  private get base() {
    return this.config.api + '/api/v1/scrape';
  }

  feed(url: string, origin = ''): Observable<void> {
    return this.http.post<void>(`${this.base}/feed`, null, {
      params: params({ url, origin }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  webScrape(url: string): Observable<Ref> {
    this.cacheList.add(url);
    return this.http.get<Ref>(`${this.base}/web`, {
      params: params({ url }),
    }).pipe(
      map(ref => {
        if (!ref) {
          throw 'Web scrape failed';
        }
        return ref;
      }),
      map(mapRef),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  fetch(url: string): Observable<string> {
    this.cacheList.add(url);
    return this.http.get(`${this.base}/fetch`, {
      params: params({ url }),
      responseType: 'text'
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  rss(url: string): Observable<string> {
    this.cacheList.add(url);
    return this.http.get(`${this.base}/rss`, {
      params: params({ url }),
      responseType: 'text'
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  scrape(url: string) {
    if (url.startsWith('data:')) return;
    if (this.cacheList.has(url)) return;
    this.cacheList.add(url);
    const s = () => {
      this.http.get<null>(this.base, {
        params: params({ url: this.scraping[0] }),
      }).pipe(
        catchError(() => of(null)),
      ).subscribe(() => {
        this.scraping.shift();
        if (this.scraping.length) s();
      });
    };
    this.scraping.push(url);
    if (this.scraping.length === 1) s();
  }

  refresh(url: string): Observable<void> {
    return this.http.post(`${this.base}/refresh`, null, {
      params: params({ url }),
      responseType: 'text'
    }).pipe(
      map(() => {}),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  cache(file: File): Observable<string> {
    return this.http.post(`${this.base}/cache`, file, {
      responseType: 'text'
    }).pipe(
      tap(url => this.cacheList.add(url)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  getFetch(url?: string, thumbnail = false) {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    if (this.config.preAuthScrape && this.store.account.user) this.scrape(url);
    if (thumbnail) return `${this.base}/fetch?thumbnail=true&url=${encodeURIComponent(url)}`;
    return `${this.base}/fetch?url=${encodeURIComponent(url)}`;
  }

  defaults(): Observable<any> {
    return this.refs.update(catchAll, true).pipe(
      switchMap(() => this.clearConfigCache())
    );
  }

  clearDeleted() {
    return this.http.post(`${this.base}/clear-deleted`, null).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  clearConfigCache() {
    return this.http.post(`${this.base}/clear-config-cache`, null).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
