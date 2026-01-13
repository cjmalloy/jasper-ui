import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { autorun } from 'mobx';
import { catchError, map, Observable, of, throwError } from 'rxjs';
import { mapRef, Ref } from '../../model/ref';
import { Resource } from '../../model/resource';
import { catchAll } from '../../mods/scrape';
import { Store } from '../../store/store';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';
import { RefService } from './ref.service';

@Injectable({
  providedIn: 'root',
})
export class ProxyService {

  private cacheList = new Set<string>();

  private scraping: Ref[] = [];

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private store: Store,
    private refs: RefService,
    private login: LoginService,
  ) {
    autorun(() => {
      if (store.eventBus.event === '_plugin/cache:clear-cache') {
        this.clearDeleted(store.account.origin).subscribe();
      }
    });
  }

  private get base() {
    return this.config.api + '/api/v1/proxy';
  }

  prefetch(url: string, origin = '', filename = 'file') {
    if (url.startsWith('data:')) return;
    if (this.cacheList.has(origin + url)) return;
    this.cacheList.add(origin + url);
    const s = () => {
      this.http.get(`${this.base}/prefetch/${encodeURIComponent(this.scraping[0]?.title?.trim() || this.scraping[0].url)}`, {
        params: params({ url: this.scraping[0].url, origin: this.scraping[0].origin }),
      }).pipe(
        catchError(() => of(null)),
      ).subscribe(() => {
        this.scraping.shift();
        if (this.scraping.length) s();
      });
    };
    this.scraping.push({ url, origin, title: filename });
    if (this.scraping.length === 1) s();
  }

  fetch(url: string, origin = '', filename = 'file', thumbnail?: boolean): Observable<Resource> {
    this.cacheList.add(origin + url);
    return this.http.get(`${this.base}/${encodeURIComponent(filename)}`, {
      params: params({ url, origin, thumbnail }),
      observe: 'response',
      responseType: 'arraybuffer',
    }).pipe(
      map(req => ({
        url: this.getFetch(url, origin, filename, thumbnail),
        mimeType: req.headers.get('Content-Type'),
        data: req.body
      })),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  save(file: File, origin = ''): Observable<HttpEvent<Ref>> {
    return this.http.post(`${this.base}`, file, {
      params: params({ title: file.name, mime: file.type, origin }),
      reportProgress: true,
      observe: 'events',
    }).pipe(
      map(res => res as HttpEvent<Ref>),
      map(res => {
        // @ts-ignore
        if ('body' in res && res.body) res.body = mapRef(res.body);
        return res;
      }),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  getFetch(url: string, origin = '', filename = 'file', thumbnail = false) {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    if (this.config.prefetch && this.store.account.user) this.prefetch(url, origin, filename);
    if (thumbnail) return `${this.base}/${encodeURIComponent(filename.trim())}?thumbnail=true&url=${encodeURIComponent(url)}&origin=${origin}`;
    return `${this.base}/${encodeURIComponent(filename.trim())}?url=${encodeURIComponent(url)}&origin=${origin}`;
  }

  isProxied(url?: string) {
    return url && url.startsWith(this.base);
  }

  defaults(): Observable<any> {
    return this.refs.update(catchAll);
  }

  clearDeleted(origin: string) {
    return this.http.delete(this.base, {
      params: { origin },
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
      catchError(err => {
        // TODO: Better error message
        alert(err.message);
        return throwError(() => err);
      }),
    );
  }
}
