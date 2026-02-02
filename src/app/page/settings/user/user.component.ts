import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  Injector,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { defer } from 'lodash-es';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-settings-user-page',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
  imports: [UserListComponent],
})
export class SettingsUserPage implements OnInit, OnDestroy, HasChanges {
  private injector = inject(Injector);
  private mod = inject(ModService);
  config = inject(ConfigService);
  store = inject(Store);
  users = inject(UserService);
  scim = inject(ProfileStore);
  query = inject(UserStore);


  @ViewChild('list')
  list?: UserListComponent;

  constructor() {
    const mod = this.mod;
    const store = this.store;
    const scim = this.scim;
    const query = this.query;

    mod.setTitle($localize`Settings: User Profiles`);
    store.view.clear(['tag:len', 'tag'], ['tag:len', 'tag']);
    scim.clear();
    query.clear();
  }

  ngOnInit(): void {
    if (this.config.scim) {
      // TODO: better way to find unattached profiles
      effect(() => {
        const args = {
          page: this.store.view.pageNumber,
          size: this.store.view.pageSize,
        };
        defer(() => this.scim.setArgs(args));
      }, { injector: this.injector });
    }
    effect(() => {
      const args = {
        query: this.store.view.showRemotes ? '@*' : (this.store.account.origin || '*'),
        search: this.store.view.search,
        sort: [...this.store.view.sort],
        page: this.store.view.pageNumber,
        size: this.store.view.pageSize,
        ...getTagFilter(this.store.view.filter),
      };
      defer(() => this.query.setArgs(args));
    }, { injector: this.injector });
  }

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnDestroy() {
    this.query.close();
  }
}
