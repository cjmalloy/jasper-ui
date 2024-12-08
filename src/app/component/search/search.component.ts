import { Component, HostBinding, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { debounce } from 'lodash-es';
import { autorun, IReactionDisposer, toJS } from 'mobx';
import { filter } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { Store } from '../../store/store';
import { View } from '../../store/view';

@Component({
  standalone: false,
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'search form-group';

  private disposers: IReactionDisposer[] = [];

  searchValue = '';
  replace = false;

  private searchEvent = false;

  constructor(
    public router: Router,
    public store: Store,
    public admin: AdminService,
  ) {
    this.disposers.push(autorun(() => {
      this.searchValue = toJS(this.store.view.search);
    }));
    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
    ).subscribe(() => this.replace = false);
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  change(target: HTMLInputElement) {
    this.searchValue = target.value;
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
      case 'inbox/ref': return this.admin.getPlugin(this.store.view.childTag)?.name || this.store.view.childTag;
      case 'ref/thread': return $localize`thread`;
      case 'ref/comments': return $localize`comments`;
      case 'ref/responses': return $localize`responses`;
      case 'ref/sources': return $localize`sources`;
      case 'ref/versions': return $localize`versions`;
      case 'settings/user': return $localize`permissions`;
      case 'settings/plugin': return $localize`plugins`;
      case 'settings/template': return $localize`templates`;
      case 'settings/ref': return this.admin.getPlugin(this.store.view.childTag)?.name || this.store.view.childTag;
    }
    return view || '';
  }
}
