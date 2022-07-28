import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { combineLatest, filter, map, Observable, startWith, Subject, switchMap, takeUntil } from 'rxjs';
import { distinctUntilChanged, tap } from 'rxjs/operators';
import { Ref } from '../../../model/ref';
import { inboxes } from '../../../plugin/inbox';
import { AccountService } from '../../../service/account.service';
import { RefService } from '../../../service/api/ref.service';
import { ThemeService } from '../../../service/theme.service';

@Component({
  selector: 'app-ref-comments',
  templateUrl: './comments.component.html',
  styleUrls: ['./comments.component.scss'],
})
export class RefCommentsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  depth$!: Observable<number>;
  sort$!: Observable<string>;
  ref$ = new Subject<Ref>();
  newComments$ = new Subject<Ref | null>();

  private depth = 7;

  constructor(
    private theme: ThemeService,
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private refs: RefService,
  ) {
    this.depth$ = this.route.queryParams.pipe(
      map(queryParams => queryParams['depth'] || this.depth),
      distinctUntilChanged(),
    );
    this.sort$ = this.route.params.pipe(
      map(params => params['sort']),
      distinctUntilChanged(),
    );
    combineLatest(this.url$, this.origin$).pipe(
      takeUntil(this.destroy$),
      switchMap(([url, origin]) => refs.get(url, origin)),
      tap(ref => theme.setTitle('Comments: ' + (ref.title || ref.url))),
    ).subscribe(ref => this.ref$.next(ref));
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    this.ref$.complete();
    this.newComments$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get url$() {
    return this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(this.router),
      switchMap(() => this.route.params),
      map(params => params['ref']),
    );
  }

  get origin$() {
    return this.route.queryParams.pipe(
      map((params) => params['origin']),
      distinctUntilChanged(),
    );
  }

  inboxes(ref: Ref) {
    return inboxes(ref, this.account.tag);
  }
}
