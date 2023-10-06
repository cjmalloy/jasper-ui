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

  toggleTag(tag: string) {
    const tags = this.tags;
    if (tag) {
      if (tags.includes(tag)) {
        for (let i = tags.length - 1; i >= 0; i--) {
          if (tag === tags[i] || tags[i].startsWith(tag + '/')) {
            tags.splice(i, 1);
          }
        }
      } else {
        tags.push(tag);
      }
    }
    this.tags = tags;
  }

  get tags() {
    return this.store.submit.tags;
  }

  set tags(tags: string[]) {
    this.router.navigate([], {
      queryParams: { tag: tags.length ? tags : null, pageNumber: null },
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
