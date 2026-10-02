import { Component, ChangeDetectionStrategy, viewChild, effect, inject, Injector, afterNextRender, DestroyRef } from '@angular/core';
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
import { getArgs } from '../../util/query';

@Component({
  selector: 'app-home-page',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LensComponent,
    TabsComponent,
    RouterLink,
    SidebarComponent,
  ],
})
export class HomePage implements HasChanges {

  private readonly injector = inject(Injector);

  readonly lens = viewChild<LensComponent>('lens');

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
    effect(() => {
      if (this.store.view.forYou()) {
        this.account.forYouQuery$.subscribe(q => {
          const args = getArgs(
            q,
            this.store.view.sort(),
            ['user/!plugin/user/hide', ...this.store.view.filter()],
            this.store.view.search(),
            this.store.view.pageNumber(),
            this.store.view.pageSize(),
          );
          defer(() => this.query.setArgs(args));
        })
      } else {
        const args = getArgs(
          this.store.account.subscriptionQuery(),
          this.store.view.sort(),
          ['user/!plugin/user/hide', ...this.store.view.filter()],
          this.store.view.search(),
          this.store.view.pageNumber(),
          this.store.view.pageSize(),
        );
        defer(() => this.query.setArgs(args));
      }
    }, { injector: this.injector });
  });

  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => {
    this.query.close();
  });

}
