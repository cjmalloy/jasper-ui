import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { without } from 'lodash-es';
import { Store } from '../store/store';

@Injectable({
  providedIn: 'root'
})
export class BookmarkService {

  constructor(
    private store: Store,
    private router: Router,
  ) { }

  toggleFilter(query: string) {
    if (this.store.view.queryFilters.includes(query)) {
      this.filters = without(this.store.view.filter, 'query/' + query);
    } else {
      this.filters = [...this.store.view.filter, 'query/' + query];
    }
  }

  get filters() {
    return this.store.view.filter;
  }

  set filters(filters: string[]) {
    this.router.navigate([], {
      queryParams: { filter: filters.length ? filters : null, pageNumber: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  get pageSize() {
    return this.store.view.pageSize;
  }

  set pageSize(value: number) {
    this.router.navigate([], { queryParams: { pageSize: value }, queryParamsHandling: 'merge' });
  }

  set cols(value: number) {
    this.router.navigate([], { queryParams: { cols: value }, queryParamsHandling: 'merge' });
  }
}
