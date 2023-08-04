import { Injectable } from '@angular/core';
import { without } from 'lodash-es';
import { Router } from '@angular/router';
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
      this.setFilters(without(this.store.view.filter, 'query/' + query));
    } else {
      this.setFilters([...this.store.view.filter, 'query/' + query]);
    }
  }

  setFilters(filters: string[]) {
    this.router.navigate([], {
      queryParams: { filter: filters.length ? filters : null, pageNumber: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
