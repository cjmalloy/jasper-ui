import { computed, inject, Injectable } from '@angular/core';
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
    const filters = filter(this.store.view.filter(), f => !clear.find(p => f.startsWith(p)));
    if (filters.includes(f)) {
      this.setFilters(without(filters, f));
    } else {
      this.setFilters([...without(filters, toggle(f)), f]);
    }
  }

  clearFilters(...prefix: string[]) {
    this.setFilters(filter(this.store.view.filter(), f => !prefix.find(p => f.startsWith(p))));
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

  readonly filters = computed(() => this.store.view.filter());

  setFilters(filters: string[]) {
    this.router.navigate([], {
      queryParams: { filter: filters.length ? filters : null, pageNumber: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  readonly origin = computed(() => this.store.view.origin());

  setOrigin(origin: string) {
    this.router.navigate([], {
      queryParams: { origin },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  toggleTag(...ts: string[]) {
    if (!ts.length) return;
    const tags = [...this.pendingTags || this.tags()];
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
    this.setTags(tags);
  }

  readonly tags = computed(() => this.store.submit.tags());

  /**
   * Tags set by a navigation that has not finished yet, so toggling
   * several tags in a row does not undo the previous toggles.
   */
  private pendingTags?: string[];

  setTags(tags: string[]) {
    this.pendingTags = tags;
    this.router.navigate([], {
      queryParams: { tag: tags.length ? tags : null, pageNumber: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    }).finally(() => {
      if (this.pendingTags === tags) this.pendingTags = undefined;
    });
  }

  readonly to = computed(() => this.store.submit.to());

  setTo(tos: string[]) {
    if (tos.join(' ') === this.store.submit.to().join(' ')) return;
    this.router.navigate([], {
      queryParams: { to: tos.length ? tos : null, pageNumber: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  readonly pageSize = computed(() => this.store.view.pageSize());

  setPageSize(value: number) {
    this.router.navigate([], { queryParams: { pageSize: value }, queryParamsHandling: 'merge' });
  }

  set cols(value: number) {
    this.router.navigate([], { queryParams: { cols: value }, queryParamsHandling: 'merge' });
  }
}
