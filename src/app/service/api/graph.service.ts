import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { mapRefOrNull, RefNode } from '../../model/ref';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root'
})
export class GraphService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);
  private login = inject(LoginService);


  private get base() {
    return this.config.api + '/api/v1/graph';
  }

  list(urls: string[]): Observable<(RefNode | null)[]> {
    if (!urls?.length) return of([]);
    return this.http.get(`${this.base}/list`, {
      params: params({ urls }),
    }).pipe(
      map(res => res as any[]),
      map(res => res.map(mapRefOrNull)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
