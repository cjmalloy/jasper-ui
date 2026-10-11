import { Component, computed, effect, inject, viewChild } from '@angular/core';
import { uniq } from 'lodash-es';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { AdminService } from '../../../service/admin.service';
import { AuthzService } from '../../../service/authz.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  selector: 'app-settings-ref-page',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
  imports: [RefListComponent],
})
export class SettingsRefPage implements HasChanges {
  private mod = inject(ModService);
  private admin = inject(AdminService);
  private auth = inject(AuthzService);
  store = inject(Store);
  query = inject(QueryStore);


  readonly plugin = computed(() => this.admin.getPlugin(this.store.view.settingsTag()));
  readonly writeAccess = computed(() => this.auth.canAddTag(this.store.view.settingsTag()));

  readonly list = viewChild<RefListComponent>('list');

  constructor() {
    const mod = this.mod;
    const store = this.store;

    mod.setTitle($localize`Settings: `);
    store.view.clear(['metadata->newResponse']);
    // Sync the document title
    effect(() => this.mod.setTitle($localize`Settings: ${this.plugin()?.config?.settings || this.store.view.settingsTag()}`));
    this.query.watch(() => getArgs(
      this.store.view.settingsTag() + (this.store.view.showRemotes() ? '' : (this.plugin()?.origin || '@')),
      this.store.view.sort(),
      uniq(['!obsolete', ...this.store.view.filter()]),
      this.store.view.search(),
      this.store.view.pageNumber(),
      this.store.view.pageSize(),
    ));
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }

  loadDefaults() {
    if (!this.plugin()?.config?.defaultsConfirm || confirm(this.plugin()?.config?.defaultsConfirm)) {
      this.store.eventBus.fire(this.store.view.settingsTag() + ':defaults');
    }
  }

  clearCache() {
    if (!this.plugin()?.config?.clearCacheConfirm || confirm(this.plugin()?.config?.clearCacheConfirm)) {
      this.store.eventBus.fire(this.store.view.settingsTag() + ':clear-cache');
    }
  }
}

export const getSettings = () => {
  const auth = inject(AuthzService);
  return inject(AdminService).settings().find(p => auth.tagReadAccess(p.tag))?.tag || '';
};
