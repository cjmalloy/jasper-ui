import { ChangeDetectionStrategy, Component, effect, Injector, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { defer } from 'lodash-es';

import { catchError, filter, of, Subject, Subscription, switchMap, takeUntil } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { StompService } from '../../../service/api/stomp.service';
import { BookmarkService } from '../../../service/bookmark.service';
import { ConfigService } from '../../../service/config.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getTitle } from '../../../util/format';
import { getArgs } from '../../../util/query';
import { hasTag, updateMetadata } from '../../../util/tag';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ref-errors',
  templateUrl: './errors.component.html',
  styleUrl: './errors.component.scss',
  host: { 'class': 'errors' },
  imports: [ RefListComponent]
})
export class RefErrorsComponent implements OnInit, OnDestroy, HasChanges {

  private destroy$ = new Subject<void>();

  @ViewChild('list')
  list?: RefListComponent;

  newRefs$ = new Subject<Ref | undefined>();

  private watch?: Subscription;

  constructor(
    private injector: Injector,
    public config: ConfigService,
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
    private stomp: StompService,
    private refs: RefService,
    private bookmarks: BookmarkService,
  ) {
    query.clear();
    store.view.defaultSort = ['published'];
    if (!this.store.view.filter.length) bookmarks.filters = ['query/' + (store.account.origin || '*')];
  }

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnInit(): void {
    effect(() => {
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
    }, { injector: this.injector });
    // TODO: set title for bare reposts
    effect(() => this.mod.setTitle($localize`Errors: ` + getTitle(this.store.view.ref)), { injector: this.injector });
    effect(() => {
      if (this.store.view.url && this.config.websockets) {
        this.watch?.unsubscribe();
        this.watch = this.stomp.watchResponse(this.store.view.url).pipe(
          switchMap(url => this.refs.getCurrent(url)),
          tap(ref => updateMetadata(this.store.view.ref!, ref)),
          filter(ref => hasTag('+plugin/log', ref)),
          catchError(err => of(undefined)),
          takeUntil(this.destroy$),
        ).subscribe(ref => this.newRefs$.next(ref));
      }
    }, { injector: this.injector });
  }

  ngOnDestroy() {
    this.query.close();
    this.destroy$.next();
    this.destroy$.complete();
  }

}
