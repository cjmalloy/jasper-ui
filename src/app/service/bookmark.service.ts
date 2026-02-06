import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { filter, without } from 'lodash-es';
import { Store } from '../store/store';
import { toggle, UrlFilter } from '../util/query';

@Injectable({
  providedIn: 'root'
})
export class BookmarkService {
  private store = inject(Store);
  private router = inject(Router);


  toggleFilter(f: UrlFilter, ...clear: string[]) {
    const filters = filter(this.store.view.filter, f => !clear.find(p => f.startsWith(p)));
    if (filters.includes(f)) {
      this.filters = without(filters, f);
    } else {
      this.filters = [...without(filters, toggle(f)), f];
    }
  }

  clearFilters(...prefix: string[]) {
    this.filters = filter(this.store.view.filter, f => !prefix.find(p => f.startsWith(p)));
  }

  toggleQuery(query: string) {
    this.toggleFilter('query/' + query as UrlFilter);
  }

  toggleSources(url: string) {
    this.toggleFilter('sources/' + url as UrlFilter, 'responses/' + url);
  }

  toggleResponses(url: string) {
    this.toggleFilter('responses/' + url as UrlFilter, 'sources/' + url);
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

  get origin() {
    return this.store.view.origin;
  }

  set origin(origin: string) {
    this.router.navigate([], {
      queryParams: { origin },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  toggleTag(...ts: string[]) {
    if (!ts.length) return;
    const tags = this.tags;
    for (const t of ts) {
      if (tags.includes(t)) {
        for (let i = tags.length - 1; i >= 0; i--) {
          if (t === tags[i] || tags[i].startsWith(t + '/')) {
            tags.splice(i, 1);
          }
        }
      } else {
        tags.push(t);
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

  get to() {
    return this.store.submit.to;
  }

  set to(tos: string[]) {
    if (tos.join(' ') === this.store.submit.to.join(' ')) return;
    this.router.navigate([], {
      queryParams: { to: tos.length ? tos : null, pageNumber: null },
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
