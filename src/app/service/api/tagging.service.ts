import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable } from 'rxjs';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root'
})
export class TaggingService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private login: LoginService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/tags';
  }

  create(tag: string, url: string, origin = ''): Observable<void> {
    if (tag.includes(' ')) {
      return this.patch(tag.split(/\s+/), url, origin);
    }
    if (tag.startsWith('-')) return this.delete(tag.substring(1), url, origin);
    return this.http.post<void>(this.base, null, {
      params: params({ tag, url, origin }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  delete(tag: string, url: string, origin = ''): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: params({ tag, url, origin }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  patch(tags: string[], url: string, origin = ''): Observable<void> {
    return this.http.patch<void>(this.base, null, {
      params: params({ tags, url, origin }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  createResponse(tag: string, url: string): Observable<void> {
    if (tag.startsWith('-')) return this.deleteResponse(tag.substring(1), url);
    return this.http.post<void>(`${this.base}/response`, null, {
      params: params({ tag, url }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  deleteResponse(tag: string, url: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/response`, {
      params: params({ tag, url }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
