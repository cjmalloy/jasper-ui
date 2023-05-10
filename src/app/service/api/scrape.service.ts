import { HttpClient, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { autorun } from 'mobx';
import { catchError, map, Observable } from 'rxjs';
import { mapRef, Ref } from '../../model/ref';
import { Store } from '../../store/store';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root',
})
export class ScrapeService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private store: Store,
    private login: LoginService,
  ) {
    autorun(() => {
      if (this.store.eventBus.event === 'scrape') {
        this.store.eventBus.runAndReload(this.feed(this.store.eventBus.ref.url, this.store.eventBus.ref.origin));
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
    return this.http.get<Ref>(`${this.base}/web`, {
      params: params({ url }),
    }).pipe(
      map(mapRef),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  fetch(url: string): Observable<any> {
    return this.http.get<any>(`${this.base}/fetch`, {
      params: params({ url }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  cache(file: File): Observable<string> {
    return this.http.post(`${this.base}/cache`, file, {
      responseType: 'text'
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  getFetch(url: string) {
    return `${this.base}/fetch?url=${encodeURIComponent(url)}`;
  }
}
