import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash';
import { combineLatest, map, Observable, switchMap } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { ThemeService } from '../../../service/theme.service';
import { getArgs } from '../../../util/query';

@Component({
  selector: 'app-sent',
  templateUrl: './sent.component.html',
  styleUrls: ['./sent.component.scss']
})
export class InboxSentPage implements OnInit {

  page$: Observable<Page<Ref>>;

  private defaultPageSize = 20;

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    public account: AccountService,
    private route: ActivatedRoute,
    private refs: RefService,
  ) {
    theme.setTitle('Inbox: Sent');
    this.page$ = combineLatest(
      this.sort$, this.filter$, this.search$, this.pageNumber$, this.pageSize$,
    ).pipe(
      map(([sort, filter, search, pageNumber, pageSize]) =>
        getArgs(account.tag, sort, filter, search, pageNumber, pageSize ?? this.defaultPageSize)),
      distinctUntilChanged(_.isEqual),
      switchMap(args => this.refs.page(args)),
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
