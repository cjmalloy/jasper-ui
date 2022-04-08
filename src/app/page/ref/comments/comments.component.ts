import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map, mergeMap, Observable, Subject } from 'rxjs';
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

  depth$: Observable<number>;
  url$: Observable<string>;
  ref$: Observable<Ref>;
  inboxes$: Observable<string[]>;
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
    this.url$ = this.route.parent!.params.pipe(
      map(params => params['ref']),
      distinctUntilChanged(),
    );
    this.ref$ = this.url$.pipe(
      mergeMap(url => this.refs.get(url)),
    );
    this.inboxes$ = this.ref$.pipe(
      map(ref => inboxes(ref, this.account.tag)),
    );
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    this.newComments$.complete();
  }
}
