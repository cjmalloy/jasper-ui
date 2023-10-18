import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { delay } from 'lodash-es';
import { catchError, map, Observable, shareReplay } from 'rxjs';
import { all, BackupOptions } from '../../model/backup';
import { params } from '../../util/http';
import { CACHE_MS } from '../account.service';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

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

  create(options: BackupOptions = all): Observable<string> {
    return this.http.post(`${this.base}`, options, {
      responseType: 'text'
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  list(): Observable<string[]> {
    return this.http.get(`${this.base}`).pipe(
      map(res => res as string[]),
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

  restore(id: string, options: BackupOptions = all) {
    return this.http.post(`${this.base}/restore/${id}`, options, {
      responseType: 'text'
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  backfill(): Observable<void> {
    return this.http.post<void>(`${this.base}/backfill`, null).pipe(
        catchError(err => this.login.handleHttpError(err)),
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  upload(file: File): Observable<string> {
    return this.http.post(`${this.base}/upload/${file.name}`, file, {
      responseType: 'text'
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
