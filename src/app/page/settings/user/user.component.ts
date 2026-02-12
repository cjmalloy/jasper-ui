import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { UserListComponent } from '../../../component/user/user-list/user-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { UserService } from '../../../service/api/user.service';
import { ConfigService } from '../../../service/config.service';
import { ModService } from '../../../service/mod.service';
import { ProfileStore } from '../../../store/profile';
import { Store } from '../../../store/store';
import { UserStore } from '../../../store/user';
import { getTagFilter } from '../../../util/query';

@Component({
  selector: 'app-settings-user-page',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
  imports: [UserListComponent],
})
export class SettingsUserPage implements OnInit, OnDestroy, HasChanges {

  private disposers: IReactionDisposer[] = [];

  @ViewChild('list')
  list?: UserListComponent;

  constructor(
    private mod: ModService,
    public config: ConfigService,
    public store: Store,
    public users: UserService,
    public scim: ProfileStore,
    public query: UserStore,
  ) {
    mod.setTitle($localize`Settings: User Profiles`);
    store.view.clear(['tag:len', 'tag'], ['tag:len', 'tag']);
    scim.clear();
    query.clear();
  }

  saveChanges() {
    return !this.list || this.list.saveChanges();
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
    this.query.close();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }
}
