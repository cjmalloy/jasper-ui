import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
import { from, Subscription } from 'rxjs';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { AccountService, compareCursors } from '../../../service/account.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';

@Component({
  selector: 'app-unread',
  templateUrl: './unread.component.html',
  styleUrls: ['./unread.component.scss'],
  host: { 'class': 'unread' },
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [MobxAngularModule, RefListComponent]
})
export class InboxUnreadPage implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];
  private readThrough = new Map<string, string>();
  private cleared = Promise.resolve();
  private loads = 0;
  private load?: Subscription;

  constructor(
    private mod: ModService,
    public store: Store,
    public query: QueryStore,
    private account: AccountService,
    private router: Router,
    private destroyRef: DestroyRef,
  ) {
    mod.setTitle($localize`Inbox: Unread`);
    store.view.clear(['modified']);
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      if (this.store.view.pageNumber) {
        this.router.navigate([], {
          queryParams: { pageNumber: null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
        this.cleared = this.clearNotifications();
      }
      const cleared = this.cleared;
      const load = ++this.loads;
      defer(() => {
        from(cleared).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
          if (load !== this.loads) return;
          this.load?.unsubscribe();
          this.load = this.account.notificationPage$(this.store.view.pageSize).subscribe(page =>
            runInAction(() => this.query.page = page));
        });
      });
    }));
    this.disposers.push(autorun(() => {
      if (this.query.page && this.query.page!.content.length) {
        for (const ref of this.query.page.content) {
          const origin = ref.origin || '';
          const cursor = ref.modifiedString;
          const current = this.readThrough.get(origin);
          if (!cursor || current && compareCursors(cursor, current) <= 0) continue;
          this.readThrough.set(origin, cursor);
        }
      }
    }));
  }

  ngOnDestroy() {
    this.query.close();
    this.load?.unsubscribe();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.clearNotifications();
  }

  private clearNotifications(): Promise<void> {
    const cleared = Promise.all(Array.from(this.readThrough,
      ([origin, cursor]) => this.account.clearNotifications(cursor, [origin])));
    this.readThrough.clear();
    return cleared.then(() => undefined, err => console.error(err));
  }
}
