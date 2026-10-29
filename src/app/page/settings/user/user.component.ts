import { Component, inject, viewChild } from '@angular/core';
import { UserListComponent } from '../../../component/user/user-list/user-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { UserService } from '../../../service/api/user.service';
import { ConfigService } from '../../../service/config.service';
import { ModService } from '../../../service/mod.service';
import { ProfileStore } from '../../../store/profile';
import { Store } from '../../../store/store';
import { UserStore } from '../../../store/user';
import { getTagFilter, getTagQueryFilter } from '../../../util/query';

@Component({
  selector: 'app-settings-user-page',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
  imports: [UserListComponent],
})
export class SettingsUserPage implements HasChanges {
  private mod = inject(ModService);
  config = inject(ConfigService);
  store = inject(Store);
  users = inject(UserService);
  scim = inject(ProfileStore);
  query = inject(UserStore);


  readonly list = viewChild<UserListComponent>('list');

  constructor() {
    const mod = this.mod;
    const store = this.store;

    mod.setTitle($localize`Settings: User Profiles`);
    store.view.clear(['tag:len', 'tag'], ['tag:len', 'tag']);
    if (this.config.scim) {
      // TODO: better way to find unattached profiles
      this.scim.watch(() => ({
        page: this.store.view.pageNumber(),
        size: this.store.view.pageSize(),
      }));
    }
    this.query.watch(() => ({
      query: getTagQueryFilter(this.store.view.showRemotes() ? '@*' : (this.store.account.origin() || '*'), this.store.view.filter()),
      search: this.store.view.search(),
      sort: [...this.store.view.sort()],
      page: this.store.view.pageNumber(),
      size: this.store.view.pageSize(),
      ...getTagFilter(this.store.view.filter()),
    }));
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }
}
