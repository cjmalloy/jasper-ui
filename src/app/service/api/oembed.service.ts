import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { Oembed } from '../../model/oembed';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root'
})
export class OEmbedService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private login: LoginService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/oembed';
  }

  twitter(url: string, theme?: string, maxwidth?: number, maxheight?: number): Observable<Oembed> {
    return this.http.get(this.base + '/twitter', {
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

  bitChute(url: string, theme?: string, maxwidth?: number, maxheight?: number): Observable<Oembed> {
    return this.http.get(this.base + '/bitChute', {
      params: params({
        url,
        theme,
        maxwidth,
        maxheight,
        format: 'json',
      }),
    }).pipe(
      map(t => t as Oembed),
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
