import { Component, viewChild, effect, untracked, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, filter, of, Subject, Subscription, switchMap } from 'rxjs';
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
  selector: 'app-ref-errors',
  templateUrl: './errors.component.html',
  styleUrl: './errors.component.scss',
  host: { 'class': 'errors' },
  imports: [RefListComponent]
})
export class RefErrorsComponent implements HasChanges {
  config = inject(ConfigService);
  private mod = inject(ModService);
  admin = inject(AdminService);
  store = inject(Store);
  query = inject(QueryStore);
  private stomp = inject(StompService);
  private refs = inject(RefService);
  private bookmarks = inject(BookmarkService);


  readonly list = viewChild<RefListComponent>('list');

  newRefs$ = new Subject<Ref | undefined>();

  private watch?: Subscription;

  constructor() {
    const store = this.store;
    const bookmarks = this.bookmarks;
    store.view.defaultSort.set(['published']);
    if (!this.store.view.filter().length) bookmarks.setFilters(['query/' + (store.account.origin() || '*')]);
    const untilDestroyed = takeUntilDestroyed<Ref | undefined>();
    this.query.watch(() => ({
      ...getArgs(
        '+plugin/log:!plugin/delete',
        this.store.view.sort(),
        this.store.view.filter(),
        this.store.view.search(),
        this.store.view.pageNumber(),
        this.store.view.pageSize(),
      ),
      responses: this.store.view.url(),
    }));
    // TODO: set title for bare reposts
    effect(() => this.mod.setTitle($localize`Errors: ` + getTitle(this.store.view.ref())));
    effect(() => {
      this.store.view.url();
      untracked(() => {
        if (this.store.view.url() && this.config.websockets) {
          this.watch?.unsubscribe();
          this.watch = this.stomp.watchResponse(this.store.view.url()).pipe(
            switchMap(url => this.refs.getCurrent(url)),
            tap(ref => updateMetadata(this.store.view.ref()!, ref)),
            filter(ref => hasTag('+plugin/log', ref)),
            catchError(err => of(undefined)),
            untilDestroyed,
          ).subscribe(ref => this.newRefs$.next(ref));
        }
      });
    });
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }

}
