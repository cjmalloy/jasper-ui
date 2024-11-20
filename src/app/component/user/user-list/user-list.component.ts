import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { find } from 'lodash-es';
import { catchError, of } from 'rxjs';
import { Page } from '../../../model/page';
import { Profile } from '../../../model/profile';
import { User } from '../../../model/user';
import { ProfileService } from '../../../service/api/profile.service';

@Component({
  standalone: false,
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.scss']
})
export class UserListComponent implements OnInit {
  @HostBinding('class') css = 'user-list';


  @Input()
  scim?: Page<Profile>;
  private _page?: Page<User>;
  private cache: Map<string, Profile | undefined> = new Map();

  constructor(
    private router: Router,
    private profiles: ProfileService,
  ) { }

  get page() {
    return this._page;
  }

  @Input()
  set page(value: Page<User> | undefined) {
    this.cache.clear();
    this._page = value;
  }

  ngOnInit(): void {
  }

  hasUser(tag: string) {
    return !!find(this.page?.content, p => p.tag === tag);
  }

  getProfile(user: User) {
    const tag = user.tag + user.origin;
    if (!this._page) this._page = {} as any;
    if (!this.cache.has(tag)) {
      const profile = find(this.scim?.content, p => p.tag === tag);
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
