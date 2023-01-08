import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as _ from 'lodash-es';
import { autorun, IReactionDisposer, toJS } from 'mobx';
import { RefSort } from '../../model/ref';
import { TagSort } from '../../model/tag';
import { AdminService } from '../../service/admin.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-sort',
  templateUrl: './sort.component.html',
  styleUrls: ['./sort.component.scss']
})
export class SortComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'sort form-group';

  private disposers: IReactionDisposer[] = [];

  allSorts: {value: RefSort | TagSort, label?: string}[] = [
    { value: 'modified' },
  ];
  sorts: string[] = [];

  constructor(
    public router: Router,
    public admin: AdminService,
    public store: Store,
  ) {
    this.type = 'ref';
    this.disposers.push(autorun(() => {
      this.sorts = toJS(this.store.view.sort);
      if (!Array.isArray(this.sorts)) this.sorts = [this.sorts];
    }));
  }

  @Input()
  set type(value: 'ref' | 'ext' | 'user' | 'plugin' | 'template') {
    if (value === 'ref') {
      this.allSorts = [
        { value: 'url' },
        { value: 'origin' },
        { value: 'title' },
        { value: 'comment', label: 'comments' },
        { value: 'created', label: 'new' },
        { value: 'tagCount', label: 'tags' },
        { value: 'sourceCount', label: 'sources' },
        { value: 'responseCount', label: 'responses' },
        { value: 'published' },
        { value: 'modified' },
      ]
      if (this.admin.status.plugins.comment) {
        this.allSorts.splice(1, 0, { value: 'commentCount', label: 'comments' });
      }
      if (this.store.view.search) {
        this.allSorts.unshift({ value: 'rank', label: 'relevance' });
      }
    }
    if (value !== 'ref') {
      this.allSorts = [
        { value: 'tag' },
        { value: 'origin' },
        { value: 'name' },
        { value: 'modified' },
      ]
    }
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  addSort() {
    if (!this.sorts) this.sorts = [];
    this.sorts.push('');
  }

  setSortCol(index: number, value: string) {
    const dir = this.sortDir(this.sorts[index])
    this.sorts[index] = value + ',' + dir;
    this.setSort();
  }

  setSortDir(index: number, value: string) {
    const col = this.sortCol(this.sorts[index])
    this.sorts[index] = col + ',' + value;
    if (col) this.setSort();
  }

  removeSort(index: number) {
    this.sorts.splice(index, 1);
    this.setSort();
  }

  setSort() {
    const sort = _.filter(this.sorts, f => !!f && !f.startsWith(','));
    this.router.navigate([], { queryParams: { sort: sort.length ? sort : null, pageNumber: null }, queryParamsHandling: 'merge' });
  }

  sortCol(sort: string) {
    if (!sort.includes(',')) return sort;
    return sort.split(',')[0];
  }

  sortDir(sort: string) {
    if (!sort.includes(',')) return 'DESC';
    return sort.split(',')[1];
  }
}
