import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  Injector,
  OnDestroy,
  OnInit,
  viewChild
} from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-settings-ref-page',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
  imports: [ RefListComponent],
})
export class SettingsRefPage implements OnInit, OnDestroy, HasChanges {
  private injector = inject(Injector);
  private mod = inject(ModService);
  private admin = inject(AdminService);
  private auth = inject(AuthzService);
  store = inject(Store);
  query = inject(QueryStore);


  plugin?: Plugin;
  writeAccess = false;

  readonly list = viewChild<RefListComponent>('list');

  constructor() {
    const mod = this.mod;
    const store = this.store;
    const query = this.query;

    mod.setTitle($localize`Settings: `);
    store.view.clear(['metadata->modified']);
    query.clear();
  }

  ngOnInit(): void {
    effect(() => {
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
    }, { injector: this.injector });
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }

  ngOnDestroy() {
    this.query.close();
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
