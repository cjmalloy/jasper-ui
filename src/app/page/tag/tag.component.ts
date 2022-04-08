import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import * as _ from 'lodash';
import { catchError, combineLatest, filter, map, Observable, of, shareReplay } from 'rxjs';
import { distinctUntilChanged, mergeMap, scan, take } from 'rxjs/operators';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { ExtService } from '../../service/api/ext.service';
import { RefService } from '../../service/api/ref.service';
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

  private defaultPageSize = 20;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private refs: RefService,
    private exts: ExtService,
  ) {
    this.page$ = combineLatest(
      this.tag$, this.filter$, this.pageNumber$, this.pageSize$,
    ).pipe(
      distinctUntilChanged(_.isEqual),
      mergeMap(([tag, filter, pageNumber, pageSize]) => {
        return this.getArgs(tag, filter).pipe(
          mergeMap(args => this.refs.page({
            ...args,
            page: pageNumber,
            size: pageSize ?? this.defaultPageSize,
          })));
      }));
    this.localTag$ = this.tag$.pipe(
      map(tag => localTag(tag)),
    );
    this.ext$ = this.localTag$.pipe(
      mergeMap(tag => tag ? this.exts.get(tag) : of(null)),
      shareReplay(1),
    );
    this.title$ = this.ext$.pipe(
      mergeMap(ext => ext
        ? of(ext.name || ext.tag)
        : this.tag$)
    );
    this.pinned$ = this.ext$.pipe(
      filter(ext => !!ext),
      mergeMap(ext => of(...ext!.config.pinned as string[])),
      mergeMap(pin => this.refs.get(pin)),
      scan((acc, value) => [...acc, value], [] as Ref[]),
      catchError(() => of([])),
      take(1),
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

  get filter$() {
    return this.route.params.pipe(
      map(params => params['filter']),
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

  getArgs(tag: string, filter: string): Observable<Record<string, any>> {
    const query = `${tag}:!internal@*`;
    if (filter === 'new') {
      return of({ query });
    }
    if (filter === 'uncited') {
      return of({ query, uncited: true });
    }
    if (filter === 'unsourced') {
      return of({ query, unsourced: true });
    }
    throw `Invalid filter ${filter}`;
  }

}
