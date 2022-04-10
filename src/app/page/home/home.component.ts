import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash';
import { combineLatest, map, Observable, of } from 'rxjs';
import { distinctUntilChanged, mergeMap } from 'rxjs/operators';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';

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
    public admin: AdminService,
    public account: AccountService,
    private route: ActivatedRoute,
    private refs: RefService,
  ) {
    this.path$ = this.route.url.pipe(
      map(segments => segments[0].path),
    );
    this.page$ = combineLatest(
      [this.path$, this.filter$, this.pageNumber$, this.pageSize$],
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
    this.route.queryParams.pipe(
      map(params => params['graph']),
    ).subscribe(graph => this.graph = graph);
  }

  ngOnInit(): void {
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
    // TODO: implement parentheses in queries
    if (path === 'home') {
      if (filter === 'new') {
        return this.account.subscriptions$.pipe(
          map(subs => ({ query: subs.join(':!internal@*+') + ':!internal@*' })),
        );
      }
      if (filter === 'uncited') {
        return this.account.subscriptions$.pipe(
          map(subs => ({ query: subs.join(':!internal@*+') + ':!internal@*', uncited: true })),
        );
      }
      if (filter === 'unsourced') {
        return this.account.subscriptions$.pipe(
          map(subs => ({ query: subs.join(':!internal@*+') + ':!internal@*', unsourced: true })),
        );
      }
      if (filter === 'modlist') {
        return this.account.subscriptions$.pipe(
          map(subs => ({ query: subs.join(':!internal@*:!_moderated@*+') + ':!internal@*:!_moderated' })),
        );
      }
      if (filter === 'imodlist') {
        return this.account.subscriptions$.pipe(
          map(subs => ({ query: subs.join(':!_moderated@*+') + ':!_moderated' })),
        );
      }
      throw `Invalid filter ${filter}`;
    }
    if (path === 'all') {
      if (filter === 'new') {
        return of({ query: '!internal@*' });
      }
      if (filter === 'uncited') {
        return of({ query: '!internal@*', uncited: true });
      }
      if (filter === 'unsourced') {
        return of({ query: '!internal@*', unsourced: true });
      }
      if (filter === 'modlist') {
        return of({ query: '!internal@*:!_moderated' });
      }
      if (filter === 'imodlist') {
        return of({ query: '!_moderated' });
      }
    }
    throw `Invalid path ${path}`;
  }

}
