import { Component, inject, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
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


  private readonly forYouQuery = rxResource({
    params: () => this.store.view.forYou() || undefined,
    stream: () => this.account.forYouQuery$,
  });

  readonly lens = viewChild<LensComponent>('lens');

  constructor() {
    const mod = this.mod;
    const admin = this.admin;
    const store = this.store;
    const exts = this.exts;

    mod.setTitle($localize`Home`);
    store.view.clear([!!admin.getPlugin('plugin/user/vote/up') ? 'plugins->plugin/user/vote:decay' : 'published']);
    if (admin.home()) {
      exts.getCachedExt('config/home' + (store.account.origin() || '@')).subscribe(x => {
        if (x.modified) {
          store.view.exts.set([x]);
        } else {
          store.view.exts.set([ { ...this.exts.defaultExt('config/home'), config: admin.getDefaults('config/home') }]);
        }
      });
    }
    this.store.view.extTemplates.set(this.admin.view());
    this.query.watch(() => {
      const query = this.store.view.forYou()
        ? (this.forYouQuery.hasValue() ? this.forYouQuery.value() : undefined)
        : this.store.account.subscriptionQuery();
      if (query === undefined) return undefined;
      return getArgs(
        query,
        this.store.view.sort(),
        ['user/!plugin/user/hide', ...this.store.view.filter()],
        this.store.view.search(),
        this.store.view.pageNumber(),
        this.store.view.pageSize(),
      );
    });
  }

  saveChanges() {
    const lens = this.lens();
    return !lens || lens.saveChanges();
  }
}
