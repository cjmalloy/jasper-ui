import {
  DestroyRef,
  inject,
  Component,
  forwardRef,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ChangeDetectionStrategy,
  input,
  viewChildren,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    forwardRef(() => CommentComponent),
  ],
})
export class CommentThreadComponent implements OnInit, OnChanges, HasChanges {
  readonly state = signal(0);

  private markState() {
    this.state.update(value => value + 1);
  }

  private destroyRef = inject(DestroyRef);

  readonly source = input('');
  readonly scrollToLatest = input(false);
  @Input()
  depth = 7;
  readonly pageSize = input<number>();
  readonly context = input(0);
  @Input()
  newComments$!: Observable<Ref | undefined>;

  readonly list = viewChildren<CommentComponent>('comment');

  newComments: Ref[] = [];

  constructor(
    public store: Store,
    public thread: ThreadStore,
  ) { }

  get comments(): Ref[] | undefined {
    let comments = this.thread.cache.get(this.source());
    if (comments && this.newComments.length) {
      const newUrls = new Set(this.newComments.map(c => c.url));
      comments = comments.filter(c => !newUrls.has(c.url));
    }
    const pageSize = this.pageSize();
    if (comments && pageSize) {
      comments = [...comments];
      comments.length = pageSize;
    }
    return comments;
  }

  saveChanges(): boolean {
    return !!this.list()?.filter(t => t.saveChanges()).length;
  }

  ngOnInit(): void {
    this.newComments$.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(comment => {
      if (comment) this.newComments = [comment, ...this.newComments];
      this.markState();
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.source || changes.pageSize) {
      this.newComments = [];
      this.markState();
    }
  }
}
