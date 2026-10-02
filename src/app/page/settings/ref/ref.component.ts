import { Component, inject, ChangeDetectionStrategy, viewChild, effect, signal, DestroyRef } from '@angular/core';
import { defer, uniq } from 'lodash-es';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Plugin } from '../../../model/plugin';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RefListComponent],
})
export class SettingsRefPage implements HasChanges {

  readonly plugin = signal<Plugin | undefined>(undefined);
  readonly writeAccess = signal<boolean>(false);

  readonly list = viewChild<RefListComponent>('list');

  constructor(
    private mod: ModService,
    private admin: AdminService,
    private auth: AuthzService,
    public store: Store,
    public query: QueryStore,
  ) {
    mod.setTitle($localize`Settings: `);
    store.view.clear(['metadata->modified']);
    query.clear();
    effect(() => {
      const plugin = this.admin.getPlugin(this.store.view.settingsTag());
      this.plugin.set(plugin);
      this.writeAccess.set(this.auth.canAddTag(this.store.view.settingsTag()));
      this.mod.setTitle($localize`Settings: ${plugin?.config?.settings || this.store.view.settingsTag()}`);
      const args = getArgs(
        this.store.view.settingsTag() + (this.store.view.showRemotes() ? '' : (plugin?.origin || '@')),
        this.store.view.sort(),
        uniq(['!obsolete', ...this.store.view.filter()]),
        this.store.view.search(),
        this.store.view.pageNumber(),
        this.store.view.pageSize(),
      );
      defer(() => this.query.setArgs(args));
    });
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }

  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => {
    this.query.close();
  });

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
