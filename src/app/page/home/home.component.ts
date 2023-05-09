import { Component, OnDestroy, OnInit } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { Ref } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
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

  homeRef?: Ref;

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    public account: AccountService,
    public store: Store,
    public query: QueryStore,
    private refs: RefService,
  ) {
    theme.setTitle($localize`Home`);
    store.view.clear(!!this.admin.status.plugins.voteUp ? 'voteScoreDecay' : 'published');
    query.clear();
    if (admin.status.templates.home) {
      refs.page({query: '+home', sort: ['published,DESC'], size: 1}).subscribe(page => {
        if (!page.empty) {
          this.homeRef = page.content[0];
        }
      });
    }
  }

  ngOnInit(): void {
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
