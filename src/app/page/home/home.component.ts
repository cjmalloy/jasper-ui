import { Component, OnDestroy, OnInit } from "@angular/core";
import { Ref } from "../../model/ref";
import { RefService } from "../../service/ref.service";
import { Page } from "../../model/page";
import { distinctUntilChanged, mergeMap } from "rxjs/operators";
import { ActivatedRoute } from "@angular/router";
import { AccountService } from "../../service/account.service";
import { combineLatest, map, Observable, of, Subject, takeUntil } from "rxjs";
import * as _ from "lodash";

@Component({
  selector: 'app-home-page',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomePage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  page?: Page<Ref>;
  defaultPageSize = 20;

  constructor(
    private route: ActivatedRoute,
    private account: AccountService,
    private refs: RefService,
  ) { }

  ngOnInit(): void {
    combineLatest(this.path$, this.filter$, this.pageNumber$, this.pageSize$,).pipe(
      takeUntil(this.destroy$),
      distinctUntilChanged(_.isEqual),
    ).subscribe(([path, filter, pageNumber, pageSize]) => this.refresh(path, filter, pageNumber, pageSize));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
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

  refresh(path: string, filter: string, pageNumber?: number, pageSize?: number) {
    this.getQuery(path, filter).pipe(
      mergeMap(query => this.refs.page({
        ...query,
        page: pageNumber,
        size: pageSize ?? this.defaultPageSize,
      }))
    ).subscribe(page => this.page = page);
  }

}
