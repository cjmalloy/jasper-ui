import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { DateTime } from 'luxon';
import { catchError, map, Observable } from 'rxjs';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root'
})
export class OriginService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);
  private login = inject(LoginService);


  private get base() {
    return this.config.api + '/api/v1/origin';
  }

  list(): Observable<string[]> {
    return this.http.get(`${this.base}`).pipe(
      map(res => res as string[]),
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
