import { Component, computed, DestroyRef, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { isEqual } from 'lodash-es';
import { from, switchMap, tap } from 'rxjs';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { AccountService, compareCursors } from '../../../service/account.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';

@Component({
  selector: 'app-unread',
  templateUrl: './unread.component.html',
  styleUrls: ['./unread.component.scss'],
  host: { 'class': 'unread' },
  imports: [RefListComponent]
})
export class InboxUnreadPage {
  private mod = inject(ModService);
  store = inject(Store);
  query = inject(QueryStore);
  private account = inject(AccountService);
  private router = inject(Router);

  private readThrough = new Map<string, string>();
  private cleared = Promise.resolve();

  // Paging to the next page marks the current page as read on the server
  private readonly page = toSignal(toObservable(computed(() => ({
    pageNumber: this.store.view.pageNumber(),
    size: this.store.view.pageSize(),
  }), { equal: isEqual })).pipe(
    switchMap(({ pageNumber, size }) => {
      if (pageNumber) {
        this.router.navigate([], {
          queryParams: { pageNumber: null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
        this.cleared = this.clearNotifications();
      }
      return from(this.cleared).pipe(
        switchMap(() => this.account.notificationPage$(size)),
        tap(page => this.readPage(page)),
      );
    }),
  ));

  constructor() {
    this.mod.setTitle($localize`Inbox: Unread`);
    this.store.view.clear(['modified']);
    this.query.show(this.page);
    inject(DestroyRef).onDestroy(() => this.clearNotifications());
  }

  private readPage(page: Page<Ref>) {
    for (const ref of page.content) {
      const origin = ref.origin || '';
      const cursor = ref.modifiedString;
      const current = this.readThrough.get(origin);
      if (!cursor || current && compareCursors(cursor, current) <= 0) continue;
      this.readThrough.set(origin, cursor);
    }
  }

  private clearNotifications(): Promise<void> {
    const cleared = Promise.all(Array.from(this.readThrough,
      ([origin, cursor]) => this.account.clearNotifications(cursor, [origin])));
    this.readThrough.clear();
    return cleared.then(() => undefined, err => console.error(err));
  }
}
