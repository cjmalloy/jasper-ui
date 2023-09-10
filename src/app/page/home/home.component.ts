import { Component, OnDestroy, OnInit } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { Ext } from '../../model/ext';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ThemeService } from '../../service/theme.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { getArgs } from '../../util/query';

@Component({
  selector: 'app-home-page',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomePage implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];

  floatingSidebar = true;
  homeExt?: Ext;

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    public account: AccountService,
    public store: Store,
    public query: QueryStore,
    private exts: ExtService,
  ) {
    theme.setTitle($localize`Home`);
    store.view.clear(!!this.admin.status.plugins.voteUp ? 'voteScoreDecay' : 'published');
    query.clear();
    if (admin.status.templates.home) {
      exts.getCachedExt('+home').subscribe(x => this.homeExt = x);
    }
  }

  ngOnInit(): void {
    runInAction(() => this.store.view.extTemplates = this.admin.tmplView);
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
    this.disposers.push(autorun(() => {
      this.floatingSidebar = !this.store.view.hasTemplate || this.store.view.isTemplate('map') || this.store.view.isTemplate('graph');
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
