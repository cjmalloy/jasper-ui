import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, Observable, of, shareReplay, Subject } from 'rxjs';
import { distinctUntilChanged, mergeMap } from 'rxjs/operators';
import { Ref } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { printError } from '../../util/http';

@Component({
  selector: 'app-ref-page',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
})
export class RefPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  ref$!: Observable<Ref | null>;
  error?: HttpErrorResponse;
  printError = printError;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private refs: RefService,
  ) {
    this.ref$ = this.url$.pipe(
      mergeMap(url => refs.get(url)),
      shareReplay(),
      catchError(err => {
        this.error = err;
        return of(null);
      }),
    );
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get url$() {
    return this.route.firstChild!.params.pipe(
      map((params) => params['ref']),
      distinctUntilChanged(),
    );
  }

}
