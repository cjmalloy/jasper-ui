import { Component, computed, forwardRef, inject, input, linkedSignal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, switchMap } from 'rxjs';
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
  imports: [
    forwardRef(() => CommentComponent),
    forwardRef(() => RefComponent),
  ]
})
export class ThreadSummaryComponent {
  private refs = inject(RefService);
  private store = inject(Store);


  readonly source = input('');
  readonly commentView = input(false);
  readonly query = input('');
  readonly depth = input(1);
  readonly pageSize = input(5);
  readonly context = input(0);
  readonly showLoadMore = input(true);
  readonly newRefs$ = input<Observable<Ref | undefined>>();

  readonly newRefs = linkedSignal({
    source: () => [this.source(), this.query(), this.pageSize()],
    computation: () => [] as Ref[],
  });
  private readonly pageResource = rxResource({
    params: () => ({
      ...getArgs(this.query(), this.store.view.sort(), this.store.view.filter()),
      responses: this.source(),
      size: this.pageSize(),
    }),
    stream: ({ params }) => this.refs.page(params),
  });
  readonly list = computed(() => this.pageResource.hasValue() ? this.pageResource.value().content : []);

  constructor() {
    toObservable(this.newRefs$).pipe(
      switchMap(refs => refs ?? EMPTY),
      takeUntilDestroyed(),
    ).subscribe(comment => {
      if (comment) this.newRefs.update(refs => [comment, ...refs]);
    });
  }


}
