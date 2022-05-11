import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { Feed, mapFeed } from '../../model/feed';
import { TweetData } from '../../model/twitter';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root'
})
export class CorsBusterService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private login: LoginService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/cors';
  }

  twitter(url: string, theme?: string, maxwidth?: number, maxheight?: number): Observable<TweetData> {
    return this.http.get(this.base + '/twitter', {
      params: params({
        url,
        theme,
        maxwidth,
        maxheight,
      }),
    }).pipe(
      map(t => t as TweetData),
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
