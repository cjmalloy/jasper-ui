import { Component, HostBinding, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { Observable, Subject, takeUntil } from 'rxjs';
import { Ref } from '../../../model/ref';
import { RefService } from '../../../service/api/ref.service';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  selector: 'app-thread-summary',
  templateUrl: './thread-summary.component.html',
  styleUrls: ['./thread-summary.component.scss'],
})
export class ThreadSummaryComponent implements OnInit, OnChanges, OnDestroy {
  @HostBinding('class') css = 'thread-summary';
  private destroy$ = new Subject<void>();

  @Input()
  source?: Ref;
  @Input()
  commentView = false;
  @Input()
  query = '';
  @Input()
  depth = 1;
  @Input()
  pageSize = 5;
  @Input()
  context = 0;
  @Input()
  showLoadMore = true;
  @Input()
  newRefs$!: Observable<Ref | undefined>;

  newRefs: Ref[] = [];
  list: Ref[] = [];

  constructor(
    private refs: RefService,
    private store: Store,
  ) { }

  ngOnInit(): void {
    this.newRefs$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(comment => {
      if (comment) this.newRefs = [comment, ...this.newRefs];
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.source) {
      this.newRefs = [];
      this.refs.page({
        ...getArgs(this.query, this.store.view.sort, this.store.view.filter),
        responses: this.source?.url,
        size: this.pageSize,
      }).subscribe(page => {
        this.list = page.content;
      });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
