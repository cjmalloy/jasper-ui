import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { LensComponent } from '../../component/lens/lens.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ModService } from '../../service/mod.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { getArgs } from '../../util/query';

@Component({
  standalone: false,
  selector: 'app-home-page',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomePage implements OnInit, OnDestroy, HasChanges {
  private disposers: IReactionDisposer[] = [];

  @ViewChild(LensComponent)
  lens?: LensComponent;

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public account: AccountService,
    public store: Store,
    public query: QueryStore,
    private exts: ExtService,
  ) {
    mod.setTitle($localize`Home`);
    store.view.clear([!!this.admin.getPlugin('plugin/vote/up') ? 'voteScoreDecay' : 'published']);
    query.clear();
    if (admin.getTemplate('home')) {
      exts.getCachedExt('home').subscribe(x => runInAction(() => this.store.view.exts = [x]));
    }
  }

  saveChanges() {
    return !!this.lens?.saveChanges();
  }

  ngOnInit(): void {
    runInAction(() => this.store.view.extTemplates = this.admin.view);
    this.disposers.push(autorun(() => {
      if (this.store.view.forYou) {
        this.account.forYouQuery$.subscribe(q => {
          const args = getArgs(
            q,
            this.store.view.sort,
            this.store.view.filter,
            this.store.view.search,
            this.store.view.pageNumber,
            this.store.view.pageSize,
          );
          defer(() => this.query.setArgs(args));
        })
      } else {
        const args = getArgs(
          this.store.account.subscriptionQuery,
          this.store.view.sort,
          this.store.view.filter,
          this.store.view.search,
          this.store.view.pageNumber,
          this.store.view.pageSize,
        );
        defer(() => this.query.setArgs(args));
      }
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
