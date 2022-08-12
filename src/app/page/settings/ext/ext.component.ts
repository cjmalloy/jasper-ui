import { Component, OnDestroy, OnInit } from '@angular/core';
import { autorun, IReactionDisposer } from 'mobx';
import { ThemeService } from '../../../service/theme.service';
import { ExtStore } from '../../../store/ext';
import { Store } from '../../../store/store';

@Component({
  selector: 'app-settings-ext-page',
  templateUrl: './ext.component.html',
  styleUrls: ['./ext.component.scss'],
})
export class SettingsExtPage implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];
  private defaultPageSize = 20;

  constructor(
    private theme: ThemeService,
    public store: Store,
    public query: ExtStore,
  ) {
    theme.setTitle('Settings: Tag Extensions');
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.query.setArgs({
        page: this.store.view.pageNumber,
        size: this.store.view.pageSize ?? this.defaultPageSize,
      });
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }
}
