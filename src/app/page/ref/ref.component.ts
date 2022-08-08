import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, combineLatest, map, Observable, of, Subject, switchMap } from 'rxjs';
import { distinctUntilChanged, tap } from 'rxjs/operators';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { printError } from '../../util/http';

@Component({
  selector: 'app-ref-page',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
})
export class RefPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  ref$: Observable<Ref | null>;
  refs$: Observable<Page<Ref> | null>;
  isTextPost = false;
  isWikiPost = false;
  origin?: string;
  error?: HttpErrorResponse;
  printError = printError;
  hideSearch$: Observable<boolean>;

  constructor(
    public admin: AdminService,
    public account: AccountService,
    private router: Router,
    private route: ActivatedRoute,
    private refs: RefService,
  ) {
    this.ref$ = combineLatest(this.url$, this.origin$).pipe(
      switchMap(([url, origin]) => refs.get(url, origin).pipe(
        catchError(err => {
          this.error = err;
          return of(null);
        }),
      )),
    );
    this.refs$ = this.url$.pipe(
      switchMap(url => refs.page({url}).pipe(
        catchError(err => {
          return of(null);
        }),
      )),
    );
    this.hideSearch$ = this.route.queryParams.pipe(
      map(params => params['hideSearch'] === 'true'),
    );
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get url$() {
    return this.route.params.pipe(
      map((params) => params['ref']),
      tap(url => this.isTextPost = url.startsWith('comment:')),
      tap(url => this.isWikiPost = url.startsWith('wiki:')),
      distinctUntilChanged(),
    );
  }

  get origin$() {
    return this.route.queryParams.pipe(
      map((params) => params['origin']),
      tap(origin => this.origin = origin),
      distinctUntilChanged(),
    );
  }

}
