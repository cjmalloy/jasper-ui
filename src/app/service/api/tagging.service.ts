import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';

@Injectable({
  providedIn: 'root'
})
export class TaggingService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/tags';
  }

  create(tag: string, url: string, origin = ''): Observable<void> {
    if (tag.startsWith('-')) return this.delete(tag.substring(1), url, origin);
    return this.http.post<void>(this.base, null, {
      params: params({ tag, url, origin }),
    });
  }

  delete(tag: string, url: string, origin = ''): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: params({ tag, url, origin }),
    });
  }
}
