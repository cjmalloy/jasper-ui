import { Component, Input, OnChanges, OnDestroy, OnInit, QueryList, SimpleChanges, ViewChildren } from '@angular/core';
import { autorun, IReactionDisposer } from 'mobx';
import { Observable, Subject, takeUntil } from 'rxjs';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ref } from '../../../model/ref';
import { Store } from '../../../store/store';
import { ThreadStore } from '../../../store/thread';
import { CommentComponent } from '../comment.component';
import { MobxAngularModule } from 'mobx-angular';

@Component({
    selector: 'app-comment-thread',
    templateUrl: './comment-thread.component.html',
    styleUrls: ['./comment-thread.component.scss'],
    host: { 'class': 'comment-thread' },
    imports: [MobxAngularModule, CommentComponent]
})
export class CommentThreadComponent implements OnInit, OnChanges, OnDestroy, HasChanges {
  private destroy$ = new Subject<void>();
  private disposers: IReactionDisposer[] = [];

  @Input()
  source = '';
  @Input()
  scrollToLatest = false;
  @Input()
  depth = 7;
  @Input()
  pageSize?: number;
  @Input()
  context = 0;
  @Input()
  newComments$!: Observable<Ref | undefined>;

  @ViewChildren('comment')
  list?: QueryList<CommentComponent>;

  comments?: Ref[] = [];
  newComments: Ref[] = [];

  constructor(
    public store: Store,
    public thread: ThreadStore,
  ) {
    this.disposers.push(autorun(() => {
      if (thread.latest.length) {
        this.comments = thread.cache.get(this.source);
        if (this.comments && this.pageSize) {
          this.comments = [...this.comments!];
          this.comments.length = this.pageSize;
        }
      }
    }));
  }

  saveChanges(): boolean {
    return !!this.list?.filter(t => t.saveChanges()).length;
  }

  ngOnInit(): void {
    this.newComments$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(comment => comment && this.newComments.unshift(comment));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.source || changes.pageSize) {
      this.newComments = [];
      this.comments = this.thread.cache.get(this.source);
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
