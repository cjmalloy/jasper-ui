import { Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { defer, uniq } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
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
  standalone: false,
  selector: 'app-settings-ref-page',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
})
export class SettingsRefPage implements OnInit, OnDestroy, HasChanges {
  private disposers: IReactionDisposer[] = [];

  plugin?: Plugin;
  writeAccess = false;

  @ViewChild(RefListComponent)
  list?: RefListComponent;

  constructor(
    private mod: ModService,
    private admin: AdminService,
    private auth: AuthzService,
    public store: Store,
    public query: QueryStore,
  ) {
    mod.setTitle($localize`Settings: `);
    store.view.clear(['modified']);
    query.clear();
  }

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.plugin = this.admin.getPlugin(this.store.view.childTag);
      this.writeAccess = this.auth.canAddTag(this.store.view.childTag);
      this.mod.setTitle($localize`Settings: ${this.plugin?.config?.settings || this.store.view.childTag}`);
      const args = getArgs(
        this.store.view.childTag + (this.store.view.showRemotes ? '' : (this.plugin?.origin || '@')),
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
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  loadDefaults() {
    if (!this.plugin?.config?.defaultsConfirm || confirm(this.plugin?.config?.defaultsConfirm)) {
      this.store.eventBus.fire(this.store.view.childTag + ':defaults');
      this.store.eventBus.reset();
    }
  }

  clearCache() {
    if (!this.plugin?.config?.clearCacheConfirm || confirm(this.plugin?.config?.clearCacheConfirm)) {
      this.store.eventBus.fire(this.store.view.childTag + ':clear-cache');
      this.store.eventBus.reset();
    }
  }
}

export const getSettings = () => {
  const auth = inject(AuthzService);
  return inject(AdminService).settings.find(p => auth.tagReadAccess(p.tag))?.tag || '';
};
