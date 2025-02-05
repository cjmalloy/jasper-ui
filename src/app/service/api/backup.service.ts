import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { delay } from 'lodash-es';
import { catchError, map, Observable, shareReplay } from 'rxjs';
import { all, BackupOptions } from '../../model/backup';
import { params } from '../../util/http';
import { CACHE_MS } from '../account.service';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

export type BackupRef = {  id: string, size?: number };

@Injectable({
  providedIn: 'root'
})
export class BackupService {

  private backupKey = '';
  private _backupKey$?: Observable<string>;

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private login: LoginService,
  ) { }

  public get base() {
    return this.config.api + '/api/v1/backup';
  }

  create(origin: string, options: BackupOptions = all): Observable<string> {
    return this.http.post(`${this.base}`, options, {
      params: params({ origin }),
      responseType: 'text'
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  list(origin: string): Observable<BackupRef[]> {
    return this.http.get<BackupRef[]>(`${this.base}`, {
      params: params({ origin }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  getDownloadKey(): Observable<string> {
    if (!this._backupKey$) {
      this._backupKey$ = this.http.post(`${this.base}/key`, null, {
        responseType: 'text',
        params: params({ key: this.backupKey }),
      }).pipe(
        map(res => this.backupKey = res as string),
        shareReplay(1),
        catchError(err => this.login.handleHttpError(err)),
      );
      delay(() => this._backupKey$ = undefined, CACHE_MS);
    }
    return this._backupKey$;
  }

  restore(origin: string, id: string, options: BackupOptions = all) {
    return this.http.post(`${this.base}/restore/${id}`, options, {
      params: params({ origin }),
      responseType: 'text'
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  regen(origin: string): Observable<void> {
    return this.http.post<void>(`${this.base}/regen`, null, {
      params: params({ origin }),
    }).pipe(
        catchError(err => this.login.handleHttpError(err)),
    );
  }

  delete(origin: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`, {
      params: params({ origin }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  upload(origin: string, file: File): Observable<string> {
    return this.http.post(`${this.base}/upload/${file.name}`, file, {
      params: params({ origin }),
      responseType: 'text'
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
