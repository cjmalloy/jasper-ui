import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash';
import { combineLatest, map, mergeMap, Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { filterListToObj, getArgs } from '../../../util/query';

@Component({
  selector: 'app-all',
  templateUrl: './all.component.html',
  styleUrls: ['./all.component.scss'],
})
export class InboxAllPage implements OnInit {

  page$: Observable<Page<Ref>>;

  private defaultPageSize = 20;

  constructor(
    public admin: AdminService,
    public account: AccountService,
    private route: ActivatedRoute,
    private refs: RefService,
  ) {
    this.page$ = combineLatest(
      this.sort$, this.filter$, this.search$, this.pageNumber$, this.pageSize$,
    ).pipe(
      map(([sort, filter, search, pageNumber, pageSize]) =>
        getArgs(account.inbox, sort, { ...filterListToObj(filter), internal: true }, search, pageNumber, pageSize ?? this.defaultPageSize)),
      distinctUntilChanged(_.isEqual),
      mergeMap(args => this.refs.page(args)),
    );
  }

  ngOnInit(): void {
  }

  get sort$() {
    return this.route.params.pipe(
      map(params => params['sort']),
    );
  }

  get filter$() {
    return this.route.queryParams.pipe(
      map(queryParams => queryParams['filter']),
    );
  }

  get search$() {
    return this.route.queryParams.pipe(
      map(queryParams => queryParams['search']),
    );
  }

  get pageNumber$() {
    return this.route.queryParams.pipe(
      map(params => params['pageNumber']),
    );
  }

  get pageSize$() {
    return this.route.queryParams.pipe(
      map(params => params['pageSize']),
    );
  }
}
