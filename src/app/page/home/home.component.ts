import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash-es';
import { combineLatest, map, Observable, switchMap } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { ThemeService } from '../../service/theme.service';
import { getArgs } from '../../util/query';

@Component({
  selector: 'app-home-page',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomePage implements OnInit {

  path$: Observable<string>;
  page$: Observable<Page<Ref>>;
  graph = false;

  private defaultPageSize = 20;

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    public account: AccountService,
    private route: ActivatedRoute,
    private refs: RefService,
  ) {
    theme.setTitle('Home');
    this.path$ = this.route.url.pipe(
      map(segments => segments[0].path),
    );
    this.page$ = combineLatest(
      [this.subs$, this.sort$, this.filter$, this.search$, this.pageNumber$, this.pageSize$],
    ).pipe(
      map(([subs, sort, filter, search, pageNumber, pageSize]) =>
        getArgs(subs, sort, filter, search, pageNumber, pageSize ?? this.defaultPageSize)),
      distinctUntilChanged(_.isEqual),
      switchMap(args => this.refs.page(args)),
    );
    this.route.queryParams.pipe(
      map(params => params['graph']),
    ).subscribe(graph => this.graph = graph === 'true');
  }

  ngOnInit(): void {
  }

  get subs$() {
    return this.account.subscriptions$.pipe(
      map(subs => subs.join(' ')),
    );
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
      map(queryParams => queryParams['search'])
    );
  }

  get pageNumber$() {
    return this.route.queryParams.pipe(
      map(queryParams => queryParams['pageNumber'])
    );
  }

  get pageSize$() {
    return this.route.queryParams.pipe(
      map(queryParams => queryParams['pageSize'])
    );
  }

}
