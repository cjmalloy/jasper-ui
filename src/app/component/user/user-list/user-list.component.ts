import { ChangeDetectionStrategy, Component, effect, input, signal, viewChildren } from '@angular/core';
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
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.scss'],
  host: { 'class': 'user-list' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UserComponent, LoadingComponent, PageControlsComponent]
})
export class UserListComponent implements HasChanges {

  readonly scim = input<Page<Profile>>();

  readonly list = viewChildren(UserComponent);

  readonly page = input<Page<User> | undefined>(undefined);
  private readonly fetched = signal<Record<string, Profile | undefined>>({});
  private requested = new Set<string>();

  constructor(
    private router: Router,
    private profiles: ProfileService,
  ) {
    effect(() => {
      this.page();
      this.requested.clear();
      this.fetched.set({});
    });
  }

  saveChanges() {
    return !this.list()?.find(u => !u.saveChanges());
  }


  hasUser(tag: string) {
    return !!find(this.page()?.content, p => p.tag === tag);
  }

  getProfile(user: User) {
    const tag = user.tag + user.origin;
    const profile = find(this.scim()?.content, p => p.tag === tag);
    if (profile) return profile;
    if (!this.requested.has(tag)) {
      this.requested.add(tag);
      this.profiles.getProfile(tag).pipe(
        catchError(e => of(undefined))
      ).subscribe(p => this.fetched.update(fetched => ({ ...fetched, [tag]: p as Profile })));
    }
    return this.fetched()[tag] || undefined;
  }
}
