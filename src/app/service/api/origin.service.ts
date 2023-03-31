import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import * as moment from 'moment';
import { catchError, map, Observable } from 'rxjs';
import { mapRefOrNull, RefNode } from '../../model/ref';
import { params } from '../../util/http';
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

  delete(origin: string, olderThan: moment.Moment): Observable<void> {
    return this.http.delete<void>(`${this.base}/${origin}`, {
      params: params({ olderThan }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
