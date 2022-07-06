import { Component, HostBinding, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import * as _ from 'lodash';
import { map } from 'rxjs';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';

@Component({
  selector: 'app-search-filter',
  templateUrl: './search-filter.component.html',
  styleUrls: ['./search-filter.component.scss']
})
export class SearchFilterComponent implements OnInit {
  @HostBinding('class') css = 'search-filter';

  searchValue = '';
  allFilters = ['uncited', 'unsourced', 'internal', 'rejected', 'unpaid', 'paid', 'disputed'];
  filters: string[] = [];

  constructor(
    public router: Router,
    public route: ActivatedRoute,
    public admin: AdminService,
    public account: AccountService,
  ) {
    if (account.mod) {
      this.allFilters.push('modlist');
    }
    this.filter$.subscribe(filter => {
      if (!filter) filter = [];
      if (!Array.isArray(filter)) filter = [filter];
      this.filters = filter;
    });
    this.search$.subscribe(search => this.searchValue = search);
  }

  ngOnInit(): void {
  }

  addFilter() {
    if (!this.filters) this.filters = [];
    this.filters.push('');
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

  get filter$() {
    return this.route.queryParams.pipe(
      map(queryParams => queryParams['filter']),
    );
  }

  get search$() {
    return this.route.queryParams.pipe(
      map(queryParams => queryParams['search']),
    );
  }

  search() {
    this.router.navigate([], { queryParams: { search: this.searchValue }, queryParamsHandling: 'merge' });
  }

}
