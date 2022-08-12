import { Component, OnDestroy, OnInit } from '@angular/core';
import { autorun, IReactionDisposer } from 'mobx';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { UserStore } from '../../../store/user';

@Component({
  selector: 'app-settings-user-page',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
})
export class SettingsUserPage implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];
  private defaultPageSize = 20;

  constructor(
    private theme: ThemeService,
    public store: Store,
    public query: UserStore,
  ) {
    theme.setTitle('Settings: User Permissions');
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
