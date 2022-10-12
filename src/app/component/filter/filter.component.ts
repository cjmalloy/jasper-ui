import { Component, HostBinding, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as _ from 'lodash-es';
import { autorun, IReactionDisposer, toJS } from 'mobx';
import { AdminService } from '../../service/admin.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-filter',
  templateUrl: './filter.component.html',
  styleUrls: ['./filter.component.scss']
})
export class FilterComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'filter form-group';

  private disposers: IReactionDisposer[] = [];

  allFilters = ['uncited', 'unsourced', 'internal'];
  filters: string[] = [];

  constructor(
    public router: Router,
    public admin: AdminService,
    public store: Store,
  ) {
    if (store.account.mod) {
      this.allFilters.push('modlist');
    }
    if (admin.status.plugins.invoicePaid) {
      this.allFilters.push('unpaid', 'paid')
    }
    if (admin.status.plugins.invoiceRejected) {
      this.allFilters.push('rejected')
    }
    if (admin.status.plugins.invoiceDisputed) {
      this.allFilters.push('disputed')
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

  setFilter(index: number, value: string) {
    this.filters[index] = value;
    this.setFilters();
  }

  removeFilter(index: number) {
    this.filters.splice(index, 1);
    this.setFilters();
  }

  setFilters() {
    const filters = _.filter(this.filters, f => !!f);
    this.router.navigate([], { queryParams: { filter: filters.length ? filters : null }, queryParamsHandling: 'merge' });
  }

}
