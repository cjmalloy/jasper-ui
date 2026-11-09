import { Component, computed, effect, inject, viewChild } from '@angular/core';
import { without } from 'lodash-es';
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


  /**
   * The plugins merged into this settings tab, or the plugin for the route.
   */
  readonly plugins = computed(() => {
    const group = this.store.view.settingsGroup();
    if (group.length) return group;
    const plugin = this.admin.getPlugin(this.store.view.settingsTag());
    return plugin ? [plugin] : [];
  });
  readonly plugin = computed(() => this.plugins()[0]);
  readonly writeAccess = computed(() => this.plugins().some(p => this.auth.canAddTag(p.tag)) || this.auth.canAddTag(this.store.view.settingsTag()));
  readonly hasDefaults = computed(() => this.plugins().some(p => p.config?.hasDefaults));
  readonly hasClearCache = computed(() => this.plugins().find(p => p.config?.hasClearCache)?.config?.hasClearCache);
  readonly settingsQuery = computed(() => {
    const remotes = this.store.view.showRemotes();
    const plugins = this.plugins();
    if (!plugins.length) return this.store.view.settingsTag() + (remotes ? '' : '@');
    return plugins.map(p => p.tag + (remotes ? '' : (p.origin || '@'))).join('|');
  });

  readonly list = viewChild<RefListComponent>('list');

  constructor() {
    const mod = this.mod;
    const store = this.store;

    mod.setTitle($localize`Settings: `);
    store.view.clear(['metadata->newResponse']);
    // Sync the document title
    effect(() => this.mod.setTitle($localize`Settings: ${this.plugin()?.config?.settings || this.store.view.settingsTag()}`));
    this.query.watch(() => getArgs(
      this.settingsQuery(),
      this.store.view.sort(),
      [...without(this.store.view.filter(), 'obsolete', '!obsolete'), '!obsolete'],
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
    for (const p of this.plugins().filter(p => p.config?.hasDefaults)) {
      if (!p.config?.defaultsConfirm || confirm(p.config.defaultsConfirm)) {
        this.store.eventBus.fire(p.tag + ':defaults');
      }
    }
  }

  clearCache() {
    for (const p of this.plugins().filter(p => p.config?.hasClearCache)) {
      if (!p.config?.clearCacheConfirm || confirm(p.config.clearCacheConfirm)) {
        this.store.eventBus.fire(p.tag + ':clear-cache');
      }
    }
  }
}

export const getSettings = () => {
  const auth = inject(AuthzService);
  return inject(AdminService).settings().find(p => auth.tagReadAccess(p.tag))?.tag || '';
};
