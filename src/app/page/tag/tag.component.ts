import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import * as _ from 'lodash';
import { catchError, combineLatest, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { distinctUntilChanged, tap } from 'rxjs/operators';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { RefService } from '../../service/api/ref.service';
import { ThemeService } from '../../service/theme.service';
import { filterListToObj, getArgs } from '../../util/query';
import { localTag } from '../../util/tag';

@Component({
  selector: 'app-tag-page',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.scss'],
})
export class TagPage implements OnInit {

  title$: Observable<string>;
  localTag$: Observable<string>;
  ext$: Observable<Ext | null>;
  page$: Observable<Page<Ref>>;
  pinned$: Observable<Ref[]>;
  graph = false;

  private defaultPageSize = 20;

  constructor(
    public admin: AdminService,
    public account: AccountService,
    private theme: ThemeService,
    private router: Router,
    private route: ActivatedRoute,
    private refs: RefService,
    private exts: ExtService,
  ) {
    this.page$ = combineLatest(
      this.tag$, this.sort$, this.filter$, this.search$, this.pageNumber$, this.pageSize$,
    ).pipe(
      map(([tag, sort, filter, search, pageNumber, pageSize]) =>
        getArgs(tag, sort, {...filterListToObj(filter), notInternal: tag === '@*'}, search, pageNumber, pageSize ?? this.defaultPageSize)),
      distinctUntilChanged(_.isEqual),
      switchMap(args => this.refs.page(args)),
    );
    this.route.queryParams.pipe(
      map(params => params['graph']),
    ).subscribe(graph => this.graph = graph === 'true');
    this.localTag$ = this.tag$.pipe(
      map(tag => localTag(tag)),
    );
    this.ext$ = this.localTag$.pipe(
      switchMap(tag => tag ? this.exts.get(tag).pipe(
        catchError(() => of(null))) : of(null)),
    );
    this.title$ = this.ext$.pipe(
      switchMap(ext => ext
        ? of(ext.name || ext.tag)
        : this.tag$
      ),
      map(title => title === '@*' ? 'All' : title),
      tap(title => theme.setTitle(title)),
    );
    this.pinned$ = this.ext$.pipe(
      switchMap(ext => !ext?.config?.pinned?.length ? of([]) :
        forkJoin((ext!.config.pinned as string[]).map(pin => this.refs.get(pin))),
      ),
    );
  }

  ngOnInit(): void {
  }

  get tag$() {
    return this.route.params.pipe(
      map(params => params['tag']),
      distinctUntilChanged(),
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
      map(params => params['pageNumber']),
    );
  }

  get pageSize$() {
    return this.route.queryParams.pipe(
      map(params => params['pageSize']),
    );
  }

}
