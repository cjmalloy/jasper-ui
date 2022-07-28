import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash';
import { combineLatest, map, Observable, switchMap } from 'rxjs';
import { distinctUntilChanged, tap } from 'rxjs/operators';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { ThemeService } from '../../../service/theme.service';
import { filterListToObj, getArgs } from '../../../util/query';

@Component({
  selector: 'app-ref-remotes',
  templateUrl: './remotes.component.html',
  styleUrls: ['./remotes.component.scss']
})
export class RefRemotesComponent implements OnInit {

  page$: Observable<Page<Ref>>;

  private defaultPageSize = 20;

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    public account: AccountService,
    private route: ActivatedRoute,
    private refs: RefService,
  ) {
    this.page$ = combineLatest(
      this.url$, this.sort$, this.filter$, this.search$, this.pageNumber$, this.pageSize$,
    ).pipe(
      map(([url, sort, filter, search, pageNumber, pageSize]) =>
        getArgs('', sort, {...filterListToObj(filter), url}, search, pageNumber, pageSize ?? this.defaultPageSize)),
      distinctUntilChanged(_.isEqual),
      switchMap(args => this.refs.page(args)),
    );
  }

  ngOnInit(): void {
  }

  get url$() {
    return this.route.params.pipe(
      map(params => params['ref']),
      tap(url => this.refs.get(url).subscribe(ref => this.theme.setTitle('Remotes: ' + (ref.title || ref.url)))),
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
