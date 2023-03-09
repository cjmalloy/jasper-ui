import { Component, ElementRef, HostBinding, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { filter } from 'lodash-es';
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

  @ViewChild('create')
  create?: ElementRef<HTMLSelectElement>;

  allSorts: {value: RefSort | TagSort, label: string}[] = [
    { value: 'modified', label: $localize`🕓️ modified` },
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
        { value: 'created', label: $localize`✨️ new` },
        { value: 'published', label: $localize`📅️ published` },
        { value: 'modified', label: $localize`🕓️ modified` },
        { value: 'title', label: $localize`🇦️ title` },
        { value: 'url', label: $localize`🔗️ url` },
        { value: 'scheme', label: $localize`🏳️️ scheme` },
        { value: 'origin', label: $localize`🏛️ origin` },
        { value: 'tagCount', label: $localize`🏷️ tags` },
        { value: 'responseCount', label: $localize`💌️ responses` },
        { value: 'sourceCount', label: $localize`📜️ sources` },
      ]
      if (this.admin.status.plugins.comment) {
        this.allSorts.splice(7, 0, { value: 'commentCount', label: $localize`💬️ comments` });
      }
      if (this.admin.status.plugins.voteUp) {
        this.allSorts.splice(0, 0, { value: 'voteCount', label: '❤️ top' });
        if (this.admin.status.plugins.voteDown) {
          this.allSorts.splice(0, 0, { value: 'voteScore', label: '📈️ score' });
        }
        this.allSorts.splice(0, 0, { value: 'voteScoreDecay', label: '🔥️ hot' });
      }
      if (this.store.view.search) {
        this.allSorts.unshift({ value: 'rank', label: $localize`🔍️ relevance` });
      }
    }
    if (value !== 'ref') {
      this.allSorts = [
        { value: 'modified', label: $localize`🕓️ modified` },
        { value: 'name', label: $localize`🇦️ name` },
        { value: 'tag', label: $localize`🏷️ tag` },
        { value: 'origin', label: $localize`🏛️ origin` },
      ]
    }
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  addSort(value: string) {
    if (!this.sorts) this.sorts = [];
    this.sorts.push('');
    this.create!.nativeElement.selectedIndex = 0;
    this.setSortCol(this.sorts.length - 1, value);
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
    const sort = filter(this.sorts, f => !!f && !f.startsWith(','));
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
