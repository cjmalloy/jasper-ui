import { ChangeDetectionStrategy, Component, inject, Input, input, QueryList, ViewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { find } from 'lodash-es';
import { catchError, of } from 'rxjs';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Page } from '../../../model/page';
import { Profile } from '../../../model/profile';
import { User } from '../../../model/user';
import { ProfileService } from '../../../service/api/profile.service';
import { LoadingComponent } from '../../loading/loading.component';
import { PageControlsComponent } from '../../page-controls/page-controls.component';
import { UserComponent } from '../user.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.scss'],
  host: { 'class': 'user-list' },
  imports: [UserComponent, LoadingComponent, PageControlsComponent]
})
export class UserListComponent implements HasChanges {
  private router = inject(Router);
  private profiles = inject(ProfileService);


  readonly scim = input<Page<Profile>>();

  @ViewChildren(UserComponent)
  list?: QueryList<UserComponent>;

  private _page?: Page<User>;
  private cache: Map<string, Profile | undefined> = new Map();

  saveChanges() {
    return !this.list?.find(u => !u.saveChanges());
  }

  get page() {
    return this._page;
  }

  @Input()
  set page(value: Page<User> | undefined) {
    this.cache.clear();
    this._page = value;
  }

  hasUser(tag: string) {
    return !!find(this.page?.content, p => p.tag === tag);
  }

  getProfile(user: User) {
    const tag = user.tag + user.origin;
    if (!this._page) this._page = {} as any;
    if (!this.cache.has(tag)) {
      const profile = find(this.scim()?.content, p => p.tag === tag);
      if (profile) {
        this.cache.set(tag, profile);
      } else {
        this.cache.set(tag, undefined);
        this.profiles.getProfile(tag).pipe(
          catchError(e => of(undefined))
        ).subscribe(p => this.cache.set(tag, p as Profile));
      }
    }
    return this.cache.get(tag) || undefined;
  }
}
