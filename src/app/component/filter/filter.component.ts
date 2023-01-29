import { Component, HostBinding, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as _ from 'lodash-es';
import { autorun, IReactionDisposer, toJS } from 'mobx';
import { Filter } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
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

  allFilters: { filters: FilterItem[], label: string }[] = [
    { label: $localize`Filters`,
      filters : [
        { filter: 'uncited', label: $localize`uncited` },
        { filter: 'unsourced', label: $localize`unsourced` },
        { filter: 'untagged', label: $localize`untagged` },
        { filter: 'internal', label: $localize`internal` },
      ]
    }
  ];
  filters: UrlFilter[] = [];

  constructor(
    public router: Router,
    public admin: AdminService,
    public store: Store,
  ) {
    if (store.account.mod) {
      this.allFilters.push({
        label: $localize`Mod Tools`,
        filters: [
          { filter: 'modlist', label: $localize`modlist` }
        ],
      });
    }
    const invoiceFilters = {
      label: $localize`Invoices`,
      filters: [] as FilterItem[],
    };
    if (admin.status.plugins.invoicePaid) {
      invoiceFilters.filters.push(
        { filter: '-plugin/invoice/paid', label: $localize`unpaid`},
        { filter: 'plugin/invoice/paid', label: $localize`paid`});
    }
    if (admin.status.plugins.invoiceRejected) {
      invoiceFilters.filters.push({ filter: 'plugin/invoice/rejected', label: $localize`rejected`});
    }
    if (admin.status.plugins.invoiceDisputed) {
      invoiceFilters.filters.push({ filter: 'plugin/invoice/disputed', label: $localize`disputed`});
    }
    if (invoiceFilters.filters.length) {
      this.allFilters.push(invoiceFilters);
    }
    this.disposers.push(autorun(() => {
      this.filters = toJS(this.store.view.filter);
      if (!Array.isArray(this.filters)) this.filters = [this.filters];
    }));
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  addFilter() {
    if (!this.filters) this.filters = [];
    this.filters.push('' as any);
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
    const filters = _.filter(this.filters, f => !!f);
    this.router.navigate([], { queryParams: { filter: filters.length ? filters : null, pageNumber: null }, queryParamsHandling: 'merge' });
  }

}
