import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DateTime } from 'luxon';
import { autorun } from 'mobx';
import { catchError, Observable } from 'rxjs';
import { Store } from '../../store/store';
import { params } from '../../util/http';
import { hasTag } from '../../util/tag';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root'
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

  push(url: string, origin = ''): Observable<void> {
    return this.http.post<void>(`${this.base}/push`, null, {
      params: params({ url, origin }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  pull(url: string, origin = ''): Observable<void> {
    return this.http.post<void>(`${this.base}/pull`, null, {
      params: params({ url, origin }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  delete(origin: string, olderThan: DateTime): Observable<void> {
    return this.http.delete<void>(`${this.base}`, {
      params: params({ origin, olderThan }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
