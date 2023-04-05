import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { mapRef, Ref } from '../../model/ref';
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
    private login: LoginService,
  ) { }

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
}
