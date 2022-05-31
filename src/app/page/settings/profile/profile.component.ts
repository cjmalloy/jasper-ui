import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash';
import { combineLatest, map, Observable, switchMap } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { Page } from '../../../model/page';
import { Profile } from '../../../model/profile';
import { User } from '../../../model/user';
import { ProfileService } from '../../../service/api/profile.service';
import { UserService } from '../../../service/api/user.service';
import { ThemeService } from '../../../service/theme.service';

@Component({
  selector: 'app-settings-profile-page',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class SettingsProfilePage implements OnInit {

  page$: Observable<Page<Profile>>;

  private defaultPageSize = 20;

  constructor(
    private theme: ThemeService,
    private route: ActivatedRoute,
    private profiles: ProfileService,
  ) {
    theme.setTitle('Settings: User Profiles');
    this.page$ = combineLatest(
      this.pageNumber$, this.pageSize$,
    ).pipe(
      distinctUntilChanged(_.isEqual),
      switchMap(([pageNumber, pageSize]) => {
        return this.profiles.page({
          page: pageNumber,
          size: pageSize ?? this.defaultPageSize,
        });
      }));
  }

  ngOnInit(): void {
  }

  get pageNumber$() {
    return this.route.queryParams.pipe(
      map(params => params['pageNumber']),
    );
  }

  get pageSize$() {
    return this.route.queryParams.pipe(
      map(params => params['pageSize']),
    );
  }
}
