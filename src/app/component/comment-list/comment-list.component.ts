import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Observable, Subject, takeUntil } from 'rxjs';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { getArgs } from '../../util/query';

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
  sort?: string | null;
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

  loadMore() {
    this.refs.page({
      ...getArgs('plugin/comment@*', this.sort!),
      responses: this.source,
      page: this.pages.length,
    }).subscribe(page => {
      this.pages.push(page);
      this.hasMore = this.pages.length < this.pages[0].totalPages;
    });
  }

}
