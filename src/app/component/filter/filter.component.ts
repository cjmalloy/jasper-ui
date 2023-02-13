import { Component, ElementRef, HostBinding, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { filter, find } from 'lodash-es';
import { autorun, IReactionDisposer, toJS } from 'mobx';
import { PluginFilter } from '../../model/plugin';
import { Filter } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';
import { Store } from '../../store/store';
import { UrlFilter } from '../../util/query';

type FilterItem = { filter: UrlFilter, label: string };

@Component({
  selector: 'app-filter',
  templateUrl: './filter.component.html',
  styleUrls: ['./filter.component.scss']
})
export class FilterComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'filter form-group';

  private disposers: IReactionDisposer[] = [];

  @ViewChild('create')
  create?: ElementRef<HTMLSelectElement>;

  allFilters: { filters: FilterItem[], label: string }[] = [
    { label: $localize`Filters`,
      filters : [
        { filter: 'uncited', label: $localize`🪄️ uncited` },
        { filter: 'unsourced', label: $localize`🪄️ unsourced` },
        { filter: 'untagged', label: $localize`🪄️ untagged` },
        { filter: 'query/internal@*', label: $localize`🕵️️ internal` },
      ],
    },
  ];
  filters: UrlFilter[] = [];

  constructor(
    public router: Router,
    public admin: AdminService,
    private auth: AuthzService,
    public store: Store,
  ) {
    for (const f of admin.filters) this.loadFilter(f);
    this.disposers.push(autorun(() => {
      this.filters = toJS(this.store.view.filter);
      if (!Array.isArray(this.filters)) this.filters = [this.filters];
    }));
  }

  loadFilter(filter: PluginFilter) {
    if (!this.auth.queryReadAccess(filter.query || filter.response)) return;
    let group = find(this.allFilters, f => f.label === (filter.group || ''));
    if (group) {
      group.filters.push(this.convertFilter(filter))
    } else {
      this.allFilters.push({
        label: filter.group || '',
        filters: [this.convertFilter(filter)],
      });
    }
  }

  convertFilter(filter: PluginFilter): FilterItem {
    if (filter.query) {
      return { filter: `query/${filter.query}`, label: filter.label || '' };
    } else {
      return { filter: filter.response!, label: filter.label || '' };
    }
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  addFilter(value: Filter) {
    if (value) {
      if (!this.filters) this.filters = [];
      this.filters.push(value);
      this.create!.nativeElement.selectedIndex = 0;
      this.setFilters();
    }
  }

  setFilter(index: number, value: Filter) {
    this.filters[index] = value;
    this.setFilters();
  }

  removeFilter(index: number) {
    this.filters.splice(index, 1);
    this.setFilters();
  }

  setFilters() {
    const filters = filter(this.filters, f => !!f);
    this.router.navigate([], { queryParams: { filter: filters.length ? filters : null, pageNumber: null }, queryParamsHandling: 'merge' });
  }

}
