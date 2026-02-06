import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { Oembed } from '../../model/oembed';
import { Store } from '../../store/store';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root'
})
export class OEmbedService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);
  private login = inject(LoginService);
  private store = inject(Store);


  constructor() {
    const store = this.store;

    effect(() => {
      if (store.eventBus.event === '+plugin/oembed:defaults' || this.store.eventBus.event === '*:defaults') {
        this.defaults().subscribe();
      }
    });
  }

  private get base() {
    return this.config.api + '/api/v1/oembed';
  }

  get(url: string, theme?: string, maxwidth?: number, maxheight?: number): Observable<Oembed> {
    return this.http.get(this.base, {
      params: params({
        url,
        theme,
        maxwidth,
        maxheight,
      }),
    }).pipe(
      map(t => t as Oembed),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  defaults(): Observable<void> {
    return this.http.post<void>(this.base + '/defaults', null).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
