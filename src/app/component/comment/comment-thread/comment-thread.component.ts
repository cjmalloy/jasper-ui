import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
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
export class CommentThreadComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'comment-thread';
  private destroy$ = new Subject<void>();
  private disposers: IReactionDisposer[] = [];

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
  private _source?: Ref;

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

  @Input()
  set source(value: Ref | undefined) {
    if (this._source === value) return;
    this._source = value;
    this.newComments = [];
    this.comments = this.thread.cache.get(value?.url);
    if (this.comments && this.pageSize) {
      this.comments = [...this.comments!];
      this.comments.length = this.pageSize;
    }
  }

  get source() {
    return this._source;
  }

  ngOnInit(): void {
    this.newComments$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(comment => comment && this.newComments.unshift(comment));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
