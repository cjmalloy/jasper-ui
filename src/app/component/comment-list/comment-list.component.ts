import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { Ref } from "../../model/ref";
import { Page } from "../../model/page";
import { RefService } from "../../service/api/ref.service";
import { Observable, Subject, takeUntil } from "rxjs";

@Component({
  selector: 'app-comment-list',
  templateUrl: './comment-list.component.html',
  styleUrls: ['./comment-list.component.scss']
})
export class CommentListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input()
  top!: Ref;
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

  constructor(
    private refs: RefService,
  ) { }

  ngOnInit(): void {
    this.source$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(source => {
      this.source = source;
      this.pages = [];
      this.loadMore();
    });
    this.newComments$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(comment => comment && this.pages[0].content.unshift(comment));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadMore() {
    this.refs.page({
      query: 'plugin/comment@*',
      responses: this.source,
      page: this.pages.length,
    }).subscribe(page => {
      this.pages.push(page);
      this.hasMore = this.pages.length < this.pages[0].totalPages;
    });
  }

}
