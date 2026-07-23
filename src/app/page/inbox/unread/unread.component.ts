import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { defer } from 'lodash-es';
import { DateTime } from 'luxon';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
import { Subscription } from 'rxjs';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { AccountService } from '../../../service/account.service';
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
  private readThrough = new Map<string, DateTime>();
  private load?: Subscription;

  constructor(
    private mod: ModService,
    public store: Store,
    public query: QueryStore,
    private account: AccountService,
    private router: Router,
  ) {
    mod.setTitle($localize`Inbox: Unread`);
    store.view.clear(['modified']);
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      let cleared = Promise.resolve();
      if (this.store.view.pageNumber) {
        this.router.navigate([], {
          queryParams: { pageNumber: null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
        cleared = this.clearNotifications();
      }
      defer(() => {
        cleared.then(() => {
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
          if (!ref.modified || this.readThrough.get(origin) && ref.modified <= this.readThrough.get(origin)!) continue;
          this.readThrough.set(origin, ref.modified);
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
    return cleared.then(() => undefined);
  }
}
