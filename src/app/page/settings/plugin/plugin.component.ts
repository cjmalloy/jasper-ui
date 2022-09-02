import { Component, OnDestroy, OnInit } from '@angular/core';
import * as _ from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { ThemeService } from '../../../service/theme.service';
import { PluginStore } from '../../../store/plugin';
import { Store } from '../../../store/store';

@Component({
  selector: 'app-settings-plugin-page',
  templateUrl: './plugin.component.html',
  styleUrls: ['./plugin.component.scss'],
})
export class SettingsPluginPage implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];
  private defaultPageSize = 20;

  constructor(
    private theme: ThemeService,
    public store: Store,
    public query: PluginStore,
  ) {
    theme.setTitle('Settings: Plugins');
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      const args = {
        page: this.store.view.pageNumber,
        size: this.store.view.pageSize ?? this.defaultPageSize,
      };
      _.defer(() => this.query.setArgs(args));
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }
}
