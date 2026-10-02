import { DestroyRef, inject, Component, forwardRef, Input, OnChanges, OnInit, SimpleChanges, ChangeDetectionStrategy, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { Ref } from '../../../model/ref';
import { RefService } from '../../../service/api/ref.service';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';
import { RefComponent } from '../../ref/ref.component';
import { CommentComponent } from '../comment.component';

@Component({
  selector: 'app-thread-summary',
  templateUrl: './thread-summary.component.html',
  styleUrls: ['./thread-summary.component.scss'],
  host: { 'class': 'thread-summary' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    forwardRef(() => CommentComponent),
    forwardRef(() => RefComponent),
  ]
})
export class ThreadSummaryComponent implements OnInit, OnChanges {
  readonly state = signal(0);

  private markState() {
    this.state.update(value => value + 1);
  }

  private destroyRef = inject(DestroyRef);

  readonly source = input('');
  readonly commentView = input(false);
  readonly query = input('');
  @Input()
  depth = 1;
  readonly pageSize = input(5);
  readonly context = input(0);
  readonly showLoadMore = input(true);
  @Input()
  newRefs$?: Observable<Ref | undefined>;

  newRefs: Ref[] = [];
  list: Ref[] = [];

  constructor(
    private refs: RefService,
    private store: Store,
  ) { }

  ngOnInit(): void {
    this.newRefs$?.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(comment => {
      if (comment) this.newRefs = [comment, ...this.newRefs];
      this.markState();
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.source) {
      this.newRefs = [];
      this.refs.page({
        ...getArgs(this.query(), this.store.view.sort, this.store.view.filter),
        responses: this.source(),
        size: this.pageSize(),
      }).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(page => {
        this.list = page.content;
        this.markState();
      });
    }
  }


}
