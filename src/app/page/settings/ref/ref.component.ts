import { Component, OnDestroy, OnInit } from '@angular/core';
import { defer, uniq } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
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
})
export class SettingsRefPage implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];

  plugin?: Plugin;
  writeAccess = false;

  constructor(
    private mod: ModService,
    private admin: AdminService,
    private auth: AuthzService,
    public store: Store,
    public query: QueryStore,
  ) {
    mod.setTitle($localize`Settings: `);
    store.view.clear('modified');
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.plugin = this.admin.getPlugin(this.store.settings.tag);
      this.writeAccess = this.auth.canAddTag(this.store.settings.tag);
      this.mod.setTitle($localize`Settings: ${this.plugin?.config?.settings || this.store.settings.tag}`);
      const args = getArgs(
        this.store.settings.tag + (this.store.view.showRemotes ? '' : (this.plugin?.origin || '@')),
        this.store.view.sort,
        uniq(['obsolete', ...this.store.view.filter]),
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
    this.store.eventBus.fire(this.store.settings.tag + ':defaults');
    this.store.eventBus.reset();
  }

  clearCache() {
    this.store.eventBus.fire(this.store.settings.tag + ':clear-cache');
    this.store.eventBus.reset();
  }
}
