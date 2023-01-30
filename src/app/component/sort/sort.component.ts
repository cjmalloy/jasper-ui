import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as _ from 'lodash-es';
import { autorun, IReactionDisposer, toJS } from 'mobx';
import { RefSort } from '../../model/ref';
import { TagSort } from '../../model/tag';
import { AdminService } from '../../service/admin.service';
import { Store } from '../../store/store';
import { Type } from '../../store/view';
import { defaultDesc } from '../../util/query';

@Component({
  selector: 'app-sort',
  templateUrl: './sort.component.html',
  styleUrls: ['./sort.component.scss']
})
export class SortComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'sort form-group';

  private disposers: IReactionDisposer[] = [];

  allSorts: {value: RefSort | TagSort, label: string}[] = [
    { value: 'modified', label: $localize`modified` },
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
  set type(value: Type) {
    if (value === 'ref') {
      this.allSorts = [
        { value: 'url', label: $localize`url` },
        { value: 'origin', label: $localize`origin` },
        { value: 'title', label: $localize`title` },
        { value: 'comment', label: $localize`comments` },
        { value: 'created', label: $localize`new` },
        { value: 'tagCount', label: $localize`tags` },
        { value: 'sourceCount', label: $localize`sources` },
        { value: 'responseCount', label: $localize`responses` },
        { value: 'published', label: $localize`published` },
        { value: 'modified', label: $localize`modified` },
      ]
      if (this.admin.status.plugins.comment) {
        this.allSorts.splice(1, 0, { value: 'commentCount', label: $localize`comments` });
      }
      if (this.store.view.search) {
        this.allSorts.unshift({ value: 'rank', label: $localize`relevance` });
      }
    }
    if (value !== 'ref') {
      this.allSorts = [
        { value: 'tag', label: $localize`tag` },
        { value: 'origin', label: $localize`origin` },
        { value: 'name', label: $localize`name` },
        { value: 'modified', label: $localize`modified` },
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
    if (!sort.includes(',')) return defaultDesc.includes(sort) ? 'DESC' : 'ASC';
    return sort.split(',')[1];
  }
}
