import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { autorun, IReactionDisposer } from 'mobx';
import { Observable, Subject, takeUntil } from 'rxjs';
import { Page } from "../../../model/page";
import { Ref, RefSort } from "../../../model/ref";
import { RefService } from "../../../service/api/ref.service";
import { Store } from "../../../store/store";
import { getArgs, UrlFilter } from "../../../util/query";

@Component({
  selector: 'app-comment-list',
  templateUrl: './comment-list.component.html',
  styleUrls: ['./comment-list.component.scss'],
})
export class CommentListComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'comment-list';
  private destroy$ = new Subject<void>();
  private disposers: IReactionDisposer[] = [];

  @Input()
  top!: Ref;
  @Input()
  depth = 1;
  @Input()
  pageSize = 5;
  @Input()
  context = 0;
  @Input()
  showLoadMore = true;
  @Input()
  newComments$!: Observable<Ref | null>;

  newComments: Ref[] = [];
  comments: Ref[] = [];
  private _source?: Ref;

  constructor(
    private refs: RefService,
    private store: Store,
  ) { }

  @Input()
  set source(value: Ref | undefined) {
    if (this._source === value) return;
    this._source = value;
    this.newComments = [];
    this.refs.page({
      ...getArgs('plugin/comment@*', this.store.view.sort, this.store.view.filter),
      responses: this._source?.url,
      size: this.pageSize,
    }).subscribe(page => {
      this.comments = page.content;
    });
  }

  ngOnInit(): void {
    this.newComments$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(comment =>
      comment && this.newComments.unshift(comment));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
