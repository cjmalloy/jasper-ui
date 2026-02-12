import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { mapRef, Ref } from '../../model/ref';
import { catchAll } from '../../mods/sync/scrape';
import { Store } from '../../store/store';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';
import { RefService } from './ref.service';

@Injectable({
  providedIn: 'root',
})
export class ScrapeService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);
  private store = inject(Store);
  private refs = inject(RefService);
  private login = inject(LoginService);


  constructor() {
    const store = this.store;

    effect(() => {
      if (store.eventBus.event === '+plugin/scrape:defaults' || store.eventBus.event === '*:defaults') {
        this.defaults().subscribe();
      }
    });
  }

  private get base() {
    return this.config.api + '/api/v1/scrape';
  }

  webScrape(url: string): Observable<Ref> {
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

  rss(url: string): Observable<string> {
    return this.http.get(`${this.base}/rss`, {
      params: params({ url }),
      responseType: 'text'
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  defaults(): Observable<any> {
    return this.refs.update({ ...catchAll, origin: this.store.account.origin }).pipe(
      catchError(err => {
        if (err.status === 404) return this.refs.create({ ...catchAll, origin: this.store.account.origin });
        return throwError(() => err);
      })
    );
  }
}
