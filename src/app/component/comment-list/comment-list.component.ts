import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import * as _ from 'lodash';
import { combineLatest, Observable, Subject, takeUntil } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';

@Component({
  selector: 'app-comment-list',
  templateUrl: './comment-list.component.html',
  styleUrls: ['./comment-list.component.scss'],
})
export class CommentListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input()
  top!: Ref;
  @Input()
  filter$?: Observable<string>;
  @Input()
  source$!: Observable<string>;
  @Input()
  depth?: number | null = 7;
  @Input()
  newComments$!: Observable<Ref | null>;

  newComments: Ref[] = [];
  pages: Page<Ref>[] = [];
  hasMore = false;

  private source?: string;
  private filter?: string;

  constructor(
    private refs: RefService,
  ) { }

  ngOnInit(): void {
    combineLatest([this.source$, this.filter$]).pipe(
      takeUntil(this.destroy$),
      distinctUntilChanged(_.isEqual),
    ).subscribe(([source, filter]) => {
      this.source = source;
      this.filter = filter;
      this.pages = [];
      this.loadMore();
    });
    this.newComments$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(comment => comment && this.pages[0].content.unshift(comment));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getArgs(filter?: string) {
    if (filter === 'all') {
      return { query: 'plugin/comment@*' };
    }
    if (filter === 'modlist') {
      return { query: 'plugin/comment@*:!_moderated@*' };
    }
    throw `Invalid filter ${filter}`;
  }

  loadMore() {
    this.refs.page({
      ...this.getArgs(this.filter),
      responses: this.source,
      page: this.pages.length,
    }).subscribe(page => {
      this.pages.push(page);
      this.hasMore = this.pages.length < this.pages[0].totalPages;
    });
  }

}
