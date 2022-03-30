import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { ConfigService } from "./config.service";
import { mapUser, User } from "../model/user";
import { map, mergeMap, Observable } from "rxjs";
import { mapPage, Page } from "../model/page";
import { params } from "../util/http";

@Injectable({
  providedIn: 'root'
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
    return this.http.post<void>(this.base, user);
  }

  get(tag: string, origin = ''): Observable<User> {
    return this.http.get(this.base, {
      params: { tag, origin },
    }).pipe(map(mapUser));
  }

  page(
    query?: string,
    page?: number,
    size?: number,
    sort?: string,
    direction?: 'asc' | 'desc',
  ): Observable<Page<User>> {
    return this.http.get(`${this.base}/list`, {
      params: params({ query, page, size, sort, direction }),
    }).pipe(map(mapPage(mapUser)));
  }

  update(user: User): Observable<void> {
    return this.http.put<void>(this.base, user);
  }

  delete(tag: string): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: { tag },
    });
  }

  clearNotifications(tag: string) : Observable<void> {
    return this.http.delete<void>(`${this.base}/notifications`, {
      params: { tag },
    });
  }

  whoAmI(): Observable<string> {
    return this.http.get(`${this.base}/whoami`, { responseType: 'text' });
  }

  getMyUser(): Observable<User> {
    return this.whoAmI()
    .pipe(mergeMap(tag => this.get(tag)));
  }
}
