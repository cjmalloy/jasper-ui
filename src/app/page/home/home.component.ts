import { Component, viewChild, effect, inject, Injector, afterNextRender, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { defer } from 'lodash-es';
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
import { getArgs, UrlFilter } from '../../util/query';

@Component({
  selector: 'app-home-page',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  imports: [
    LensComponent,
    TabsComponent,
    RouterLink,
    SidebarComponent,
  ],
})
export class HomePage implements HasChanges {
  private mod = inject(ModService);
  admin = inject(AdminService);
  account = inject(AccountService);
  store = inject(Store);
  query = inject(QueryStore);
  private exts = inject(ExtService);


  private readonly injector = inject(Injector);

  readonly lens = viewChild<LensComponent>('lens');

  constructor() {
    const mod = this.mod;
    const admin = this.admin;
    const store = this.store;
    const query = this.query;
    const exts = this.exts;

    mod.setTitle($localize`Home`);
    store.view.clear([!!admin.getPlugin('plugin/user/vote/up') ? 'plugins->plugin/user/vote:decay' : 'published']);
    query.clear();
    if (admin.home()) {
      exts.getCachedExt('config/home' + (store.account.origin() || '@')).subscribe(x => {
        if (x.modified) {
          store.view.exts.set([x]);
        } else {
          store.view.exts.set([ { ...this.exts.defaultExt('config/home'), config: admin.getDefaults('config/home') }]);
        }
      });
    }
  }

  saveChanges() {
    const lens = this.lens();
    return !lens || lens.saveChanges();
  }

  private readonly initialize = afterNextRender(() => {
    this.store.view.extTemplates.set(this.admin.view());
    effect(onCleanup => {
      const sort = this.store.view.sort();
      const filter: UrlFilter[] = ['user/!plugin/user/hide', ...this.store.view.filter()];
      const search = this.store.view.search();
      const pageNumber = this.store.view.pageNumber();
      const pageSize = this.store.view.pageSize();
      if (this.store.view.forYou()) {
        const sub = this.account.forYouQuery$.subscribe(q => {
          const args = getArgs(q, sort, filter, search, pageNumber, pageSize);
          defer(() => this.query.setArgs(args));
        });
        onCleanup(() => sub.unsubscribe());
      } else {
        const args = getArgs(this.store.account.subscriptionQuery(), sort, filter, search, pageNumber, pageSize);
        defer(() => this.query.setArgs(args));
      }
    }, { injector: this.injector });
  });

  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => {
    this.query.close();
  });

}
