import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { mapPage, Page } from '../../model/page';
import { mapUser, Roles, User, writeUser } from '../../model/user';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';

@Injectable({
  providedIn: 'root',
})
export class UserService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/user';
  }

  create(user: User): Observable<void> {
    return this.http.post<void>(this.base, writeUser(user));
  }

  get(tag: string): Observable<User> {
    return this.http.get(this.base, {
      params: params({ tag }),
    }).pipe(map(mapUser));
  }

  page(args: {
    query?: string,
    page?: number,
    size?: number,
    sort?: string,
    direction?: 'asc' | 'desc',
  }): Observable<Page<User>> {
    return this.http.get(`${this.base}/page`, {
      params: params(args),
    }).pipe(map(mapPage(mapUser)));
  }

  update(user: User): Observable<void> {
    return this.http.put<void>(this.base, writeUser(user));
  }

  delete(tag: string): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: params({ tag }),
    });
  }

  whoAmI(): Observable<Roles> {
    return this.http.get<Roles>(`${this.base}/whoami`);
  }
}
