import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { autorun } from 'mobx';
import { catchError, map, Observable, of } from 'rxjs';
import { mapRef, Ref } from '../../model/ref';
import { Resource } from '../../model/resource';
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
export class ProxyService {

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
      if (store.eventBus.event === '_plugin/cache:clear-cache') {
        this.clearDeleted().subscribe();
      }
    });
  }

  private get base() {
    return this.config.api + '/api/v1/proxy';
  }

  prefetch(url: string) {
    if (url.startsWith('data:')) return;
    if (this.cacheList.has(url)) return;
    this.cacheList.add(url);
    const s = () => {
      this.http.get(`${this.base}/prefetch`, {
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
  fetch(url: string, thumbnail?: boolean): Observable<Resource> {
    this.cacheList.add(url);
    return this.http.get(`${this.base}`, {
      params: params({ url, thumbnail }),
      observe: 'response',
      responseType: 'arraybuffer',
    }).pipe(
      map(req => ({
        url: this.getFetch(url, thumbnail),
        mimeType: req.headers.get('Content-Type'),
        data: req.body
      })),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  save(file: File): Observable<Ref> {
    return this.http.post(`${this.base}`, file).pipe(
      map(mapRef),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  getFetch(url?: string, thumbnail = false) {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    if (this.config.prefetch && this.store.account.user) this.prefetch(url);
    if (thumbnail) return `${this.base}?thumbnail=true&url=${encodeURIComponent(url)}`;
    return `${this.base}?url=${encodeURIComponent(url)}`;
  }

  isProxied(url?: string) {
    return url && url.startsWith(this.base);
  }

  defaults(): Observable<any> {
    return this.refs.update(catchAll, true);
  }

  clearDeleted() {
    return this.http.delete(this.base).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
