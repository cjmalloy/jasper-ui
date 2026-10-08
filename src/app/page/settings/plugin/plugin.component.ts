import { Component, OnDestroy, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { PluginListComponent } from '../../../component/plugin/plugin-list/plugin-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { ModService } from '../../../service/mod.service';
import { PluginStore } from '../../../store/plugin';
import { Store } from '../../../store/store';
import { getTagFilter, getTagQueryFilter } from '../../../util/query';

@Component({
  selector: 'app-settings-plugin-page',
  templateUrl: './plugin.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [PluginListComponent],
})
export class SettingsPluginPage implements OnInit, OnDestroy, HasChanges {

  @ViewChild('list')
  list?: PluginListComponent;

  private disposers: IReactionDisposer[] = [];

  constructor(
    private mod: ModService,
    public store: Store,
    public query: PluginStore,
  ) {
    mod.setTitle($localize`Settings: Plugins`);
    store.view.clear(['tag:len', 'tag'], ['tag:len', 'tag']);
    query.clear();
  }

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      const args = {
        query: getTagQueryFilter(this.store.view.showRemotes ? '@*' : (this.store.account.origin || '*'), this.store.view.filter),
        search: this.store.view.search,
        sort: [...this.store.view.sort],
        page: this.store.view.pageNumber,
        size: this.store.view.pageSize,
        ...getTagFilter(this.store.view.filter),
      };
      defer(() => this.query.setArgs(args));
    }));
  }

  ngOnDestroy() {
    this.query.close();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }
}
