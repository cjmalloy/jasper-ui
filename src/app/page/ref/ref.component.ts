import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, Observable, of, Subject, switchMap } from 'rxjs';
import { distinctUntilChanged, tap } from 'rxjs/operators';
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

  url$: Observable<string>;
  ref$: Observable<Ref | null>;
  isTextPost = false;
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
    this.url$ = this.route.params.pipe(
      map((params) => params['ref']),
      tap(url => this.isTextPost = url.startsWith('comment:') || url.startsWith('wiki:')),
      distinctUntilChanged(),
    );
    this.ref$ = this.url$.pipe(
      switchMap(url => refs.get(url).pipe(
        catchError(err => {
          this.error = err;
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

}
