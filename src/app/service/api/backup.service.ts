import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { all, BackupOptions } from '../../model/backup';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root'
})
export class BackupService {

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

  restore(id: string, options: BackupOptions = all) {
    return this.http.post(`${this.base}/restore/${id}`, options, {
      responseType: 'text'
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  upload(file: File): Observable<string> {
    const formData: FormData = new FormData();
    formData.append('fileKey', file, file.name);
    return this.http.post(`${this.base}/upload`, file, {
      responseType: 'text'
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
