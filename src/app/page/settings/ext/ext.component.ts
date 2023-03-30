import { Component, OnDestroy, OnInit } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { ThemeService } from '../../../service/theme.service';
import { ExtStore } from '../../../store/ext';
import { Store } from '../../../store/store';
import { getTagFilter } from '../../../util/query';

@Component({
  selector: 'app-settings-ext-page',
  templateUrl: './ext.component.html',
  styleUrls: ['./ext.component.scss'],
})
export class SettingsExtPage implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];

  constructor(
    private theme: ThemeService,
    public store: Store,
    public query: ExtStore,
  ) {
    theme.setTitle($localize`Settings: Tag Extensions`);
    store.view.clear('tag', 'tag');
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      const args = {
        query: this.store.view.showRemotes ? '@*' : (this.store.account.origin || '*'),
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
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }
}
