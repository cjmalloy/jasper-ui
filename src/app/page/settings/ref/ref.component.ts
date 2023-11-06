import { Component, OnDestroy, OnInit } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { Plugin } from '../../../model/plugin';
import { AdminService } from '../../../service/admin.service';
import { AuthzService } from '../../../service/authz.service';
import { ThemeService } from '../../../service/theme.service';
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
    private theme: ThemeService,
    private admin: AdminService,
    private auth: AuthzService,
    public store: Store,
    public query: QueryStore,
  ) {
    theme.setTitle($localize`Settings: `);
    store.view.clear('modified');
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.plugin = this.admin.getPlugin(this.store.settings.tag);
      this.writeAccess = this.auth.canAddTag(this.store.settings.tag);
      this.theme.setTitle($localize`Settings: ${this.plugin?.config?.settings || this.store.settings.tag}`);
      const args = getArgs(
        this.store.settings.tag + (this.store.view.showRemotes ? '' : (this.plugin?.origin || '@')),
        this.store.view.sort,
        this.store.view.filter,
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
    this.store.eventBus.fire('');
  }

  clearCache() {
    this.store.eventBus.fire(this.store.settings.tag + ':clear-cache');
    this.store.eventBus.fire('');
  }
}
