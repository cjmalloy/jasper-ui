import { Component, ViewChild } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { catchError, filter, of, Subject, Subscription, switchMap, takeUntil } from 'rxjs';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { StompService } from '../../../service/api/stomp.service';
import { ConfigService } from '../../../service/config.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';
import { hasTag, top } from '../../../util/tag';

@Component({
  standalone: false,
  selector: 'app-ref-errors',
  templateUrl: './errors.component.html',
  styleUrl: './errors.component.scss',
  host: {'class': 'errors'}
})
export class RefErrorsComponent implements HasChanges {

  private disposers: IReactionDisposer[] = [];
  private destroy$ = new Subject<void>();

  @ViewChild(RefListComponent)
  list?: RefListComponent;

  newRefs$ = new Subject<Ref | undefined>();

  private watch?: Subscription;

  constructor(
    public config: ConfigService,
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
    private stomp: StompService,
    private refs: RefService,
  ) {
    query.clear();
    runInAction(() => store.view.defaultSort = ['published']);
  }

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      const args = getArgs(
        '+plugin/log:!plugin/delete',
        this.store.view.sort,
        this.store.view.filter,
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      args.responses = this.store.view.url;
      defer(() => this.query.setArgs(args));
    }));
    this.disposers.push(autorun(() => {
      this.mod.setTitle($localize`Errors: ` + (this.store.view.ref?.title || this.store.view.url));
    }));
    this.disposers.push(autorun(() => {
      if (this.store.view.top && this.config.websockets) {
        this.watch?.unsubscribe();
        this.watch = this.stomp.watchResponse(top(this.store.view.ref)).pipe(
          takeUntil(this.destroy$),
          switchMap(url => this.refs.getCurrent(url)),
          filter(ref => hasTag('+plugin/log', ref)),
          catchError(err => of(undefined)),
        ).subscribe(ref => this.newRefs$.next(ref));
      }
    }));
    this.newRefs$.subscribe(c => {
      if (c && this.store.view.ref) {
        runInAction(() => {
          this.store.view.ref!.metadata ||= {};
          this.store.view.ref!.metadata.plugins ||= {} as any;
          this.store.view.ref!.metadata.plugins!['+plugin/log'] ||= 0;
          this.store.view.ref!.metadata.plugins!['+plugin/log']++;
        });
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
