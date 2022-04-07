import { Component, OnInit } from "@angular/core";
import { Ref } from "../../model/ref";
import { RefService } from "../../service/api/ref.service";
import { Page } from "../../model/page";
import { distinctUntilChanged, mergeMap } from "rxjs/operators";
import { ActivatedRoute } from "@angular/router";
import { AccountService } from "../../service/account.service";
import { combineLatest, map, Observable, of } from "rxjs";
import * as _ from "lodash";

@Component({
  selector: 'app-home-page',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomePage implements OnInit {

  page$: Observable<Page<Ref>>;
  defaultPageSize = 20;

  constructor(
    private route: ActivatedRoute,
    private account: AccountService,
    private refs: RefService,
  ) {
    this.page$ = combineLatest(
      this.path$, this.filter$, this.pageNumber$, this.pageSize$,
    ).pipe(
      distinctUntilChanged(_.isEqual),
      mergeMap(([path, filter, pageNumber, pageSize]) => {
        return this.getQuery(path, filter).pipe(
          mergeMap(query => this.refs.page({
            ...query,
            page: pageNumber,
            size: pageSize ?? this.defaultPageSize,
          })));
      }));
  }

  ngOnInit(): void {
  }

  get path$() {
    return this.route.url.pipe(map(segments => this.account.signedIn() ? segments[0].path : 'all'));
  }

  get filter$() {
    return this.route.params.pipe(map(params => params['filter']));
  }

  get pageNumber$() {
    return this.route.queryParams.pipe(map(queryParams => queryParams['pageNumber']));
  }

  get pageSize$() {
    return this.route.queryParams.pipe(map(queryParams => queryParams['pageSize']));
  }

  getQuery(path: string, filter: string): Observable<Record<string, any>> {
    if (path === 'home') {
      if (filter === 'new') {
        return this.account.getMyUserExt().pipe(
          mergeMap(ext => of({ query: ext.config.subscriptions.join('+') }))
        );
      }
      if (filter === 'uncited') {
        return of({ uncited: true })
      }
      if (filter === 'unsourced') {
        return of({ unsourced: true })
      }
      throw `Invalid filter ${filter}`;
    }
    if (path === 'all') {
      return of({ query: '!plugin/comment@*' });
    }
    throw `Invalid path ${path}`;
  }

}
