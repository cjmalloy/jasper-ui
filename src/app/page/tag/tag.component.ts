import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { RefService } from "../../service/ref.service";
import { distinctUntilChanged, mergeMap, scan, take } from "rxjs/operators";
import { Ref } from "../../model/ref";
import { AccountService } from "../../service/account.service";
import { catchError, combineLatest, map, Observable, of } from "rxjs";
import { ExtService } from "../../service/ext.service";
import { localTag } from "../../util/tag";
import { Page } from "../../model/page";
import * as _ from "lodash";

@Component({
  selector: 'app-tag-page',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.scss']
})
export class TagPage implements OnInit {

  page$: Observable<Page<Ref>>;
  defaultPageSize = 20;
  pinned$: Observable<Ref[]>;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private refs: RefService,
    private exts: ExtService,
  ) {
    this.page$ = combineLatest(
      this.tag$, this.filter$, this.pageNumber$, this.pageSize$
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
    this.pinned$ = this.tag$.pipe(
      map(tag => localTag(tag)),
      mergeMap(tag => this.exts.get(tag)),
      mergeMap(ext => of(...ext.config.pinned as string[])),
      mergeMap(pin => this.refs.get(pin)),
      scan((acc, value) => [...acc, value], [] as Ref[]),
      catchError(() => of([])),
      take(1),
    );
  }

  ngOnInit(): void {
  }

  get tag$() {
    return this.route.params.pipe(map(params => params['tag']));
  }

  get filter$() {
    return this.route.params.pipe(map(params => params['filter']));
  }

  get pageNumber$() {
    return this.route.queryParams.pipe(map(params => params['pageNumber']));
  }

  get pageSize$() {
    return this.route.queryParams.pipe(map(params => params['pageSize']));
  }

  getArgs(tag: string, filter: string): Observable<Record<string, any>> {
    const query = `${tag}:!plugin/comment@*`;
    if (filter === 'new') {
      return of({ query })
    }
    if (filter === 'uncited') {
      return of({ query, uncited: true })
    }
    if (filter === 'unsourced') {
      return of({ query, unsourced: true })
    }
    throw `Invalid filter ${filter}`;
  }

}
