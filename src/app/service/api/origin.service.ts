import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { mapOrigin, Origin } from '../../model/origin';
import { mapPage, Page } from '../../model/page';
import { params } from '../../util/http';
import { AccountService } from '../account.service';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root',
})
export class OriginService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private login: LoginService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/origin';
  }

  create(origin: Origin): Observable<void> {
    return this.http.post<void>(this.base, origin).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  get(origin: string): Observable<Origin> {
    return this.http.get(this.base, {
      params: params({ origin }),
    }).pipe(
      map(mapOrigin),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  page(args: {
    query?: string,
    page?: number,
    size?: number,
    sort?: string,
    direction?: 'asc' | 'desc',
  }): Observable<Page<Origin>> {
    return this.http.get(`${this.base}/page`, {
      params: params(args),
    }).pipe(
      map(mapPage(mapOrigin)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  update(origin: Origin): Observable<void> {
    return this.http.put<void>(this.base, origin).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  delete(origin: string): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: params({ origin }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
