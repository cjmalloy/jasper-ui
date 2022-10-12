import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { autorun, IReactionDisposer } from 'mobx';
import { Observable, Subject, takeUntil } from 'rxjs';
import { Page } from '../../model/page';
import { Ref, RefSort } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { Store } from '../../store/store';
import { getArgs } from '../../util/query';

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
  depth?: number | null = 7;
  @Input()
  context = 0;
  @Input()
  newComments$!: Observable<Ref | null>;

  newComments: Ref[] = [];
  pages: Page<Ref>[] = [];
  hasMore = false;
  private _source?: string;
  private sort?: RefSort[];
  private filter?: string[];

  constructor(
    private refs: RefService,
    private store: Store,
  ) {
    this.disposers.push(autorun(() => {
      this.sort = [...store.view.sort];
      this.filter = store.view.filter;
      this.newComments = [];
      this.pages = [];
      this.loadMore();
    }));
  }

  @Input()
  set source(value: string) {
    if (this._source === value) return;
    this._source = value;
    this.newComments = [];
    this.pages = [];
    this.loadMore();
  }

  ngOnInit(): void {
    this.newComments$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(comment =>
      comment && this.pages[0].content.unshift(comment));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  loadMore() {
    if (!this._source) return;
    if (!this.sort) return;
    if (!this.filter) return;
    this.refs.page({
      ...getArgs('plugin/comment@*', this.sort, this.filter),
      responses: this._source,
      page: this.pages.length,
    }).subscribe(page => {
      this.pages.push(page);
      this.hasMore = this.pages.length < this.pages[0].totalPages;
    });
  }

}
