import { Component, HostBinding, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { autorun, IReactionDisposer, toJS } from 'mobx';
import { Store } from '../../store/store';
import { View } from '../../store/view';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'search form-group';

  private disposers: IReactionDisposer[] = [];

  searchValue = '';

  constructor(
    public router: Router,
    public store: Store,
  ) {
    this.disposers.push(autorun(() => {
      this.searchValue = toJS(this.store.view.search);
    }));
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  search() {
    this.router.navigate([], { queryParams: { search: this.searchValue }, queryParamsHandling: 'merge' });
  }

  viewName(view?: View) {
    switch (view) {
      case 'tag': return this.store.view.ext?.name || this.store.view.tag;
      case 'home': return 'subscriptions';
      case 'ref/comments': return 'comments';
      case 'ref/responses': return 'responses';
      case 'ref/sources': return 'sources';
      case 'ref/versions': return 'versions';
      case 'plugin/feed': return 'feeds';
      case 'plugin/origin': return 'origins';
      case 'plugin/inbox': return 'inbox'
      case 'plugin/invoice': return 'invoices';
      case 'ext': return 'tag extensions';
      case 'user': return 'users';
      case 'plugin': return 'plugins';
      case 'template': return 'templates';
    }
    return view || '';
  }
}
