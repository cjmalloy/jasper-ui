import {
  DestroyRef,
  inject,
  Component,
  forwardRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  QueryList,
  SimpleChanges,
  ViewChildren,
  ChangeDetectionStrategy,
  input
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { autorun, IReactionDisposer } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    forwardRef(() => CommentComponent),
    MobxAngularModule,
  ],
})
export class CommentThreadComponent implements OnInit, OnChanges, OnDestroy, HasChanges {
  private destroyRef = inject(DestroyRef);
  private disposers: IReactionDisposer[] = [];

  readonly source = input('');
  readonly scrollToLatest = input(false);
  @Input()
  depth = 7;
  readonly pageSize = input<number>();
  readonly context = input(0);
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
        this.comments = thread.cache.get(this.source());
        if (this.comments && this.newComments.length) {
          const newUrls = new Set(this.newComments.map(c => c.url));
          this.comments = this.comments.filter(c => !newUrls.has(c.url));
        }
        const pageSize = this.pageSize();
        if (this.comments && pageSize) {
          this.comments = [...this.comments!];
          this.comments.length = pageSize;
        }
      }
    }));
  }

  saveChanges(): boolean {
    return !!this.list?.filter(t => t.saveChanges()).length;
  }

  ngOnInit(): void {
    this.newComments$.pipe(
      takeUntilDestroyed(this.destroyRef),
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
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
