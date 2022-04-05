import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import { RefService } from "../../service/ref.service";
import { filter, mergeMap, scan, switchMap, takeLast, tap } from "rxjs/operators";
import { Page } from "../../model/page";
import { Ref } from "../../model/ref";
import { AccountService } from "../../service/account.service";
import { BehaviorSubject, catchError, Observable, of, Subject, takeUntil } from "rxjs";
import { Ext } from "../../model/ext";
import { ExtService } from "../../service/ext.service";
import { decompose } from "../../util/tag";

@Component({
  selector: 'app-tag-page',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.scss']
})
export class TagPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  tag = '@*';
  filter = 'new';
  ext?: Ext;
  page?: Page<Ref>;
  pageNumber?: number;
  pageSize = 20;
  pinned$ = new BehaviorSubject<Ref[]>([]);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private refs: RefService,
    private exts: ExtService,
  ) {
    router.events.pipe(
      takeUntil(this.destroy$),
      filter(event => event instanceof NavigationEnd),
      switchMap(() => route.params),
      tap(params => {
        this.tag = params['tag'];
        this.filter = params['filter'];
      }),
      mergeMap(() => route.queryParams),
      tap(queryParams => {
        this.pageNumber = queryParams['pageNumber'] ?? this.pageNumber;
        this.pageSize = queryParams['pageSize'] ?? this.pageSize;
      }),
    ).subscribe(() => this.refresh())
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.pinned$.complete();
  }

  get tagNoOrigin() {
    const [tag, origin] = decompose(this.tag)
    return tag;
  }

  get localTag() {
    if (!this.tag || this.tag === '@*') return null;
    if (this.tag.endsWith('@*')) {
      return this.tag.substring(0, this.tag.length - 2);
    }
    return this.tag;
  }

  get args(): Observable<Record<string, any>> {
    const query = `${this.tag}:!plugin/comment@*`;
    if (this.filter === 'new') {
      return of({ query })
    }
    if (this.filter === 'uncited') {
      return of({ query, uncited: true })
    }
    if (this.filter === 'unsourced') {
      return of({ query, unsourced: true })
    }
    throw `Invalid filter ${this.filter}`;
  }

  refresh() {
    this.args.pipe(
      takeUntil(this.destroy$),
      mergeMap(args => this.refs.page({
        ...args,
        page: this.pageNumber,
        size: this.pageSize,
      }))
    ).subscribe(page => this.page = page);

    const localTag = this.localTag;
    if (localTag) {
      this.exts.get(localTag).pipe(
        takeUntil(this.destroy$),
        catchError(() => of(undefined)),
        tap(ext => this.ext = ext),
        mergeMap(ext => of(...(ext?.config?.pinned as string[]))),
        mergeMap(pin => this.refs.get(pin)),
        scan((acc, value) => [...acc, value], [] as Ref[]),
        catchError(() => of([])),
        takeLast(1),
      ).subscribe(fetched => this.pinned$.next(fetched));
    }
  }

}
