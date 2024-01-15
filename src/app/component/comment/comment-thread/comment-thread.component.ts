import { Component, HostBinding, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { autorun, IReactionDisposer } from 'mobx';
import { Observable, Subject, takeUntil } from 'rxjs';
import { Ref } from '../../../model/ref';
import { Store } from '../../../store/store';
import { ThreadStore } from '../../../store/thread';

@Component({
  selector: 'app-comment-thread',
  templateUrl: './comment-thread.component.html',
  styleUrls: ['./comment-thread.component.scss']
})
export class CommentThreadComponent implements OnInit, OnChanges, OnDestroy {
  @HostBinding('class') css = 'comment-thread';
  private destroy$ = new Subject<void>();
  private disposers: IReactionDisposer[] = [];

  @Input()
  source?: Ref;
  @Input()
  scrollToLatest = false;
  @Input()
  depth = 7;
  @Input()
  pageSize?: number;
  @Input()
  context = 0;
  @Input()
  newComments$!: Observable<Ref | null>;

  comments?: Ref[];
  newComments: Ref[] = [];

  constructor(
    public store: Store,
    public thread: ThreadStore,
  ) {
    this.disposers.push(autorun(() => {
      if (thread.latest) {
        this.comments = thread.cache.get(this.source?.url);
        if (this.comments && this.pageSize) {
          this.comments = [...this.comments!];
          this.comments.length = this.pageSize;
        }
      }
    }));
  }

  ngOnInit(): void {
    this.newComments$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(comment => comment && this.newComments.unshift(comment));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.source || changes.pageSize) {
      this.newComments = [];
      this.comments = this.thread.cache.get(this.source?.url);
      if (this.comments && this.pageSize) {
        this.comments = [...this.comments!];
        this.comments.length = this.pageSize;
      }
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
