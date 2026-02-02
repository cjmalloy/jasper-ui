import { ChangeDetectionStrategy, Component, effect } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { debounce } from 'lodash-es';

import { filter } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { Store } from '../../store/store';
import { View } from '../../store/view';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
  host: { 'class': 'search form-group' },
  imports: [ ReactiveFormsModule]
})
export class SearchComponent {

  searchValue = '';
  replace = false;

  private searchEvent = false;

  constructor(
    public router: Router,
    public store: Store,
    public admin: AdminService,
  ) {
    effect(() => {
      this.searchValue = this.store.view.search || '';
    });
    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
    ).subscribe(() => this.replace = false);
  }


  change(target: HTMLInputElement) {
    this.searchValue = target.value || '';
    if (this.searchEvent) return;
    if (!this.store.account.config.liveSearch) return;
    this.debounceSearch();
  }

  debounceSearch = debounce(() => this.doSearch(), 400);

  search() {
    this.searchEvent = true;
    this.doSearch();
  }

  submit() {
    if (this.searchEvent) return;
    this.doSearch();
  }

  doSearch() {
    this.router.navigate([], { queryParams: { search: this.searchValue }, queryParamsHandling: 'merge', replaceUrl: this.replace });
    this.replace ||= !!this.searchValue;
  }

  viewName(view?: View) {
    switch (view) {
      case 'tag': return this.store.view.ext?.name || this.admin.getPlugin(this.store.view.tag)?.name || this.store.view.tag;
      case 'query': return $localize`query results`;
      case 'home': return this.store.account.signedIn ? $localize`subscriptions` : $localize`home page`;
      case 'all': return $localize`all`;
      case 'local': return $localize`local`;
      case 'inbox/all': return $localize`my inbox`;
      case 'inbox/sent': return $localize`sent by me`;
      case 'inbox/alarms': return $localize`alarms`;
      case 'inbox/dms': return $localize`direct messages`;
      case 'inbox/modlist': return $localize`unmoderated`;
      case 'inbox/reports': return $localize`flagged`;
      case 'inbox/ref': return this.admin.getPlugin(this.store.view.inboxTag)?.name || this.store.view.inboxTag;
      case 'ref/thread': return $localize`thread`;
      case 'ref/comments': return $localize`comments`;
      case 'ref/responses': return $localize`responses`;
      case 'ref/sources': return $localize`sources`;
      case 'ref/versions': return $localize`versions`;
      case 'ref/errors': return $localize`errors`;
      case 'settings/user': return $localize`permissions`;
      case 'settings/plugin': return $localize`plugins`;
      case 'settings/template': return $localize`templates`;
      case 'settings/ref': return this.admin.getPlugin(this.store.view.settingsTag)?.name || this.store.view.settingsTag;
    }
    return view || '';
  }
}
