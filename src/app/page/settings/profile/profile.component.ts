import { Component, OnDestroy, OnInit } from '@angular/core';
import { autorun, IReactionDisposer } from 'mobx';
import { ThemeService } from '../../../service/theme.service';
import { ProfileStore } from '../../../store/profile';
import { Store } from '../../../store/store';

@Component({
  selector: 'app-settings-profile-page',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class SettingsProfilePage implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];
  private defaultPageSize = 20;

  constructor(
    private theme: ThemeService,
    public store: Store,
    public query: ProfileStore,
  ) {
    theme.setTitle('Settings: User Profiles');
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
