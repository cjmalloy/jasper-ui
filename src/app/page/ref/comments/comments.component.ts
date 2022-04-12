import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, map, mergeMap, Observable, startWith, Subject, switchMap, takeUntil } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { Ref } from '../../../model/ref';
import { inboxes } from '../../../plugin/inbox';
import { AccountService } from '../../../service/account.service';
import { RefService } from '../../../service/api/ref.service';

@Component({
  selector: 'app-comments',
  templateUrl: './comments.component.html',
  styleUrls: ['./comments.component.scss'],
})
export class CommentsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  depth$!: Observable<number>;
  sort$!: Observable<string>;
  ref$ = new Subject<Ref>();
  inboxes$!: Observable<string[]>;
  newComments$ = new Subject<Ref | null>();

  private depth = 7;

  constructor(
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
    this.url$.pipe(
      takeUntil(this.destroy$),
      mergeMap(url => this.refs.get(url)),
    ).subscribe(ref => this.ref$.next(ref));
    this.inboxes$ = this.ref$.pipe(
      map(ref => inboxes(ref, this.account.tag)),
    );
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
}
