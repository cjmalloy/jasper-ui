import {
  ChangeDetectionStrategy,
  Component,
  effect,
  forwardRef,
  inject,
  Input,
  input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  viewChildren
} from '@angular/core';

import { Observable, Subject, takeUntil } from 'rxjs';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ref } from '../../../model/ref';
import { Store } from '../../../store/store';
import { ThreadStore } from '../../../store/thread';
import { CommentComponent } from '../comment.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-comment-thread',
  templateUrl: './comment-thread.component.html',
  styleUrls: ['./comment-thread.component.scss'],
  host: { 'class': 'comment-thread' },
  imports: [
    forwardRef(() => CommentComponent),

  ],
})
export class CommentThreadComponent implements OnInit, OnChanges, OnDestroy, HasChanges {
  store = inject(Store);
  thread = inject(ThreadStore);

  private destroy$ = new Subject<void>();

  readonly source = input('');
  readonly scrollToLatest = input(false);
  @Input()
  depth = 7;
  readonly pageSize = input<number>();
  readonly context = input(0);
  @Input()
  newComments$!: Observable<Ref | undefined>;

  readonly list = viewChildren<CommentComponent>('comment');

  comments?: Ref[] = [];
  newComments: Ref[] = [];

  constructor() {
    const thread = this.thread;

    effect(() => {
      if (thread.latest.length) {
        this.comments = thread.cache.get(this.source());
        const pageSize = this.pageSize();
        if (this.comments && pageSize) {
          this.comments = [...this.comments!];
          this.comments.length = pageSize;
        }
      }
    });
  }

  saveChanges(): boolean {
    return !!this.list()?.filter(t => t.saveChanges()).length;
  }

  ngOnInit(): void {
    this.newComments$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(comment => comment && this.newComments.unshift(comment));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.source || changes.pageSize) {
      this.newComments = [];
      this.comments = this.thread.cache.get(this.source());
      const pageSize = this.pageSize();
      if (this.comments && pageSize) {
        this.comments = [...this.comments!];
        this.comments.length = pageSize;
      }
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
