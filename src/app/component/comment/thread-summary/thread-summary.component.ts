import { DestroyRef, inject, Component, forwardRef, OnInit, ChangeDetectionStrategy, effect, input, signal } from '@angular/core';
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
export class ThreadSummaryComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  readonly source = input('');
  readonly commentView = input(false);
  readonly query = input('');
  readonly depth = input(1);
  readonly pageSize = input(5);
  readonly context = input(0);
  readonly showLoadMore = input(true);
  readonly newRefs$ = input<Observable<Ref | undefined>>();

  readonly newRefs = signal<Ref[]>([]);
  readonly list = signal<Ref[]>([]);

  constructor(
    private refs: RefService,
    private store: Store,
  ) {
    effect(() => {
      const source = this.source();
      this.newRefs.set([]);
      this.refs.page({
        ...getArgs(this.query(), this.store.view.sort, this.store.view.filter),
        responses: source,
        size: this.pageSize(),
      }).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(page => {
        this.list.set(page.content);
      });
    });
  }

  ngOnInit(): void {
    this.newRefs$()?.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(comment => {
      if (comment) this.newRefs.set([comment, ...this.newRefs()]);
    });
  }


}
