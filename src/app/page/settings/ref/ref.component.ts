import { Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { defer, uniq } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
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
  imports: [MobxAngularModule, RefListComponent],
})
export class SettingsRefPage implements OnInit, OnDestroy, HasChanges {
  private disposers: IReactionDisposer[] = [];

  plugin?: Plugin;
  writeAccess = false;

  @ViewChild('list')
  list?: RefListComponent;

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
  }

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.plugin = this.admin.getPlugin(this.store.view.settingsTag);
      this.writeAccess = this.auth.canAddTag(this.store.view.settingsTag);
      this.mod.setTitle($localize`Settings: ${this.plugin?.config?.settings || this.store.view.settingsTag}`);
      const args = getArgs(
        this.store.view.settingsTag + (this.store.view.showRemotes ? '' : (this.plugin?.origin || '@')),
        this.store.view.sort,
        uniq(['!obsolete', ...this.store.view.filter]),
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      defer(() => this.query.setArgs(args));
    }));
  }

  ngOnDestroy() {
    this.query.close();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  loadDefaults() {
    if (!this.plugin?.config?.defaultsConfirm || confirm(this.plugin?.config?.defaultsConfirm)) {
      this.store.eventBus.fire(this.store.view.settingsTag + ':defaults');
      this.store.eventBus.reset();
    }
  }

  clearCache() {
    if (!this.plugin?.config?.clearCacheConfirm || confirm(this.plugin?.config?.clearCacheConfirm)) {
      this.store.eventBus.fire(this.store.view.settingsTag + ':clear-cache');
      this.store.eventBus.reset();
    }
  }
}

export const getSettings = () => {
  const auth = inject(AuthzService);
  return inject(AdminService).settings.find(p => auth.tagReadAccess(p.tag))?.tag || '';
};
