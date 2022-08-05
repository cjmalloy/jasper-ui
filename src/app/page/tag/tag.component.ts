import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import * as _ from 'lodash-es';
import {
  catchError,
  combineLatest,
  forkJoin,
  map,
  Observable,
  of,
  shareReplay,
  Subject,
  switchMap,
  takeUntil,
  throwError
} from 'rxjs';
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
import { hasPrefix, isQuery, removeOriginWildcard } from '../../util/tag';

@Component({
  selector: 'app-tag-page',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.scss'],
})
export class TagPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  title$: Observable<string>;
  localTag$: Observable<string>;
  ext$: Observable<Ext | null>;
  page$: Observable<Page<Ref> | null>;
  pinned$: Observable<Ref[]>;
  accessDenied = false;

  private defaultPageSize = 20;
  themes$: Observable<Record<string, string>>;
  theme$: Observable<string>;

  constructor(
    public admin: AdminService,
    public account: AccountService,
    private theme: ThemeService,
    private router: Router,
    private route: ActivatedRoute,
    private refs: RefService,
    private exts: ExtService,
  ) {
    this.page$ = this.isList$.pipe(
      switchMap(isList => !isList ? of(null) : combineLatest(
        this.tag$, this.sort$, this.filter$, this.search$, this.pageNumber$, this.pageSize$,
      ).pipe(
        map(([tag, sort, filter, search, pageNumber, pageSize]) =>
          getArgs(tag, sort, {...filterListToObj(filter), notInternal: tag === '@*'}, search, pageNumber, pageSize ?? this.defaultPageSize)),
        distinctUntilChanged(_.isEqual),
        switchMap(args => this.refs.page(args)),
        catchError(err => {
          if (err.status === 403) {
            this.accessDenied = true;
          }
          return throwError(err);
        }),
      )));
    this.localTag$ = this.tag$.pipe(
      map(tag => removeOriginWildcard(tag)),
    );
    this.ext$ = this.localTag$.pipe(
      switchMap(tag => tag ? this.exts.get(tag).pipe(
        catchError(() => of(null))) : of(null)),
      shareReplay(1),
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
    this.themes$ = this.ext$.pipe(
      map(ext => ext?.config?.themes),
    );
    this.theme$ = this.ext$.pipe(
      map(ext => ext?.config?.theme),
    );
    if (!account.watchTheme$.value) {
      this.ext$.pipe(
        takeUntil(this.destroy$),
      ).subscribe(ext => {
        const themes = ext?.config?.themes;
        const t = ext?.config?.theme;
        if (t && themes) {
          theme.setCustomCss(themes[t]);
        } else {
          theme.setCustomCss();
        }
      });
    }
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
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

  get isList$() {
    return combineLatest(this.list$, this.graph$, this.kanban$).pipe(
      map(([list, graph, kanban]) => (list || graph) || (!kanban)),
    );
  }

  get list$() {
    return this.route.queryParams.pipe(
      map(params => params['list']),
    );
  }

  get graph$() {
    return this.route.queryParams.pipe(
      map(params => params['graph']),
    );
  }

  get kanban$() {
    return this.tag$.pipe(
      map(tag => !isQuery(tag) && hasPrefix(tag, 'kanban')),
    );
  }

}
