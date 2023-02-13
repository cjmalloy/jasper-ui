import { Component, OnDestroy, OnInit } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { UserService } from '../../../service/api/user.service';
import { ConfigService } from '../../../service/config.service';
import { ThemeService } from '../../../service/theme.service';
import { ProfileStore } from '../../../store/profile';
import { Store } from '../../../store/store';
import { UserStore } from '../../../store/user';

@Component({
  selector: 'app-settings-user-page',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
})
export class SettingsUserPage implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];

  constructor(
    private theme: ThemeService,
    public config: ConfigService,
    public store: Store,
    public users: UserService,
    public scim: ProfileStore,
    public query: UserStore,
  ) {
    theme.setTitle($localize`Settings: User Profiles`);
    store.view.clear('tag', 'tag');
    scim.clear();
    query.clear();
  }

  ngOnInit(): void {
    if (this.config.scim) {
      // TODO: better way to find unattached profiles
      this.disposers.push(autorun(() => {
        const args = {
          page: this.store.view.pageNumber,
          size: this.store.view.pageSize,
        };
        defer(() => this.scim.setArgs(args));
      }));
    }
    this.disposers.push(autorun(() => {
      const args = {
        query: this.store.view.showRemotes ? '@*' : '*',
        search: this.store.view.search,
        sort: [...this.store.view.sort],
        page: this.store.view.pageNumber,
        size: this.store.view.pageSize,
      };
      defer(() => this.query.setArgs(args));
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }
}
