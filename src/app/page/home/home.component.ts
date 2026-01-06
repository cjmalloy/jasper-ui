import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
import { LensComponent } from '../../component/lens/lens.component';
import { SidebarComponent } from '../../component/sidebar/sidebar.component';
import { TabsComponent } from '../../component/tabs/tabs.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ModService } from '../../service/mod.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { getArgs } from '../../util/query';

@Component({
  selector: 'app-home-page',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  imports: [
    LensComponent,
    MobxAngularModule,
    TabsComponent,
    RouterLink,
    SidebarComponent,
  ],
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
    store.view.clear([!!admin.getPlugin('plugin/user/vote/up') ? 'plugins->plugin/user/vote:decay' : 'published']);
    query.clear();
    if (admin.getTemplate('home')) {
      exts.getCachedExt('config/home' + (store.account.origin || '@')).subscribe(x => runInAction(() => {
        if (x.modified) {
          store.view.exts = [x];
        } else {
          store.view.exts = [ { ...this.exts.defaultExt('config/home'), config: admin.getDefaults('config/home') }];
        }
      }));
    }
  }

  saveChanges() {
    return !this.lens || this.lens.saveChanges();
  }

  ngOnInit(): void {
    runInAction(() => this.store.view.extTemplates = this.admin.view);
    this.disposers.push(autorun(() => {
      if (this.store.view.forYou) {
        this.account.forYouQuery$.subscribe(q => {
          const args = getArgs(
            q,
            this.store.view.sort,
            ['user/!plugin/user/hide', ...this.store.view.filter],
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
          ['user/!plugin/user/hide', ...this.store.view.filter],
          this.store.view.search,
          this.store.view.pageNumber,
          this.store.view.pageSize,
        );
        defer(() => this.query.setArgs(args));
      }
    }));
  }

  ngOnDestroy() {
    this.query.close();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
