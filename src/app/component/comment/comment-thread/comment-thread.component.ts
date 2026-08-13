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
  ChangeDetectionStrategy
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

  comments: Ref[] = [];
  newComments: Ref[] = [];

  constructor(
    public store: Store,
    public thread: ThreadStore,
  ) {
    this.disposers.push(autorun(() => this.updateComments()));
  }

  saveChanges(): boolean {
    return !!this.list?.filter(t => t.saveChanges()).length;
  }

  ngOnInit(): void {
    this.newComments$.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(comment => {
      if (!comment) return;
      this.newComments.unshift(comment);
      this.updateComments();
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.source) this.newComments = [];
    if (changes.source || changes.pageSize) {
      this.updateComments();
    }
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  private updateComments() {
    let comments = this.thread.cache.get(this.source) || [];
    if (this.newComments.length) {
      const newRefs = new Set(this.newComments.map(comment => `${comment.origin || ''}\0${comment.url}`));
      comments = comments.filter(comment => !newRefs.has(`${comment.origin || ''}\0${comment.url}`));
    }
    this.comments = this.pageSize === undefined ? comments : comments.slice(0, this.pageSize);
  }

}
