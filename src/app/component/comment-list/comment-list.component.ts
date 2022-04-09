import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Observable, Subject, takeUntil } from 'rxjs';
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
  source!: string;
  @Input()
  filter?: string | null;
  @Input()
  depth?: number | null = 7;
  @Input()
  newComments$!: Observable<Ref | null>;

  newComments: Ref[] = [];
  pages: Page<Ref>[] = [];
  hasMore = false;

  constructor(
    private refs: RefService,
  ) { }

  ngOnInit(): void {
    this.loadMore();
    this.newComments$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(comment => comment && this.pages[0].content.unshift(comment));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getArgs(filter?: string | null) {
    if (filter === 'all') {
      return { query: 'plugin/comment@*' };
    }
    if (filter === 'modlist') {
      // TODO: detect if all children are moderated
      return { query: 'plugin/comment@*' };
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
