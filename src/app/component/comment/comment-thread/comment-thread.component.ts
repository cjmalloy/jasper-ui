import { Component, computed, forwardRef, inject, input, linkedSignal, viewChildren } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, switchMap } from 'rxjs';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ref } from '../../../model/ref';
import { Store } from '../../../store/store';
import { ThreadStore } from '../../../store/thread';
import { CommentComponent } from '../comment.component';

@Component({
  selector: 'app-comment-thread',
  templateUrl: './comment-thread.component.html',
  styleUrls: ['./comment-thread.component.scss'],
  host: { 'class': 'comment-thread' },
  imports: [
    forwardRef(() => CommentComponent),
  ],
})
export class CommentThreadComponent implements HasChanges {
  store = inject(Store);
  thread = inject(ThreadStore);


  readonly source = input('');
  readonly scrollToLatest = input(false);
  readonly depth = input(7);
  readonly pageSize = input<number>();
  readonly context = input(0);
  readonly newComments$ = input<Observable<Ref | undefined>>();

  readonly list = viewChildren<CommentComponent>('comment');

  readonly newComments = linkedSignal({
    source: () => [this.source(), this.pageSize()],
    computation: () => [] as Ref[],
  });

  constructor() {
    toObservable(this.newComments$).pipe(
      switchMap(comments => comments ?? EMPTY),
      takeUntilDestroyed(),
    ).subscribe(comment => {
      if (comment) this.newComments.update(comments => [comment, ...comments]);
    });
  }

  readonly comments = computed((): readonly Ref[] | undefined => {
    let comments = this.thread.cache().get(this.source());
    if (comments && this.newComments().length) {
      const newUrls = new Set(this.newComments().map(c => c.url));
      comments = comments.filter(c => !newUrls.has(c.url));
    }
    const pageSize = this.pageSize();
    if (comments && pageSize) {
      comments = comments.slice(0, pageSize);
    }
    return comments;
  });

  saveChanges(): boolean {
    return this.list().every(t => t.saveChanges());
  }

}
