import { Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { autorun, IReactionDisposer, toJS } from 'mobx';
import { filter } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { Store } from '../../store/store';
import { Type } from '../../store/view';
import { convertSort, defaultDesc, SortItem } from '../../util/query';

@Component({
  selector: 'app-sort',
  templateUrl: './sort.component.html',
  styleUrls: ['./sort.component.scss'],
  host: { 'class': 'sort form-group' },
  imports: [ReactiveFormsModule, FormsModule]
})
export class SortComponent implements OnChanges, OnDestroy {
  private disposers: IReactionDisposer[] = [];

  @ViewChild('create')
  create?: ElementRef<HTMLSelectElement>;

  @Input()
  type?: Type;

  allRefSorts = this.admin.refSorts.map(convertSort);
  allTagSorts = this.admin.tagSorts.map(convertSort);
  allSorts: SortItem[] = [
    { value: 'modified', label: $localize`🕓️ modified` },
    { value: 'origin:len', label: $localize`🪆 nesting` },
  ];
  sorts: string[] = [];
  replace = false;

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
    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
    ).subscribe(() => this.replace = false);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.type) {
      if (this.type === 'ref') {
        this.allSorts = [...this.allRefSorts];
        if (this.store.view.search) {
          this.allSorts.unshift({ value: 'rank', label: $localize`🔍️ relevance`, title: $localize`Search rank` });
        }
      } else {
        this.allSorts = [...this.allTagSorts];
      }
    }
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  addSort(value: string) {
    this.replace = false;
    if (!this.sorts) this.sorts = [];
    this.sorts.push('');
    this.create!.nativeElement.selectedIndex = 0;
    this.setSortCol(this.sorts.length - 1, value);
  }

  setSortCol(index: number, value: string) {
    const dir = this.sortDir(value)
    this.sorts[index] = value + ',' + dir;
    this.setSort();
  }

  setSortDir(index: number, value: string) {
    const col = this.sortCol(this.sorts[index])
    this.sorts[index] = col + ',' + value;
    if (col) this.setSort();
  }

  removeSort(index: number) {
    this.replace = false;
    this.sorts.splice(index, 1);
    this.setSort();
  }

  setSort() {
    const sort = this.sorts.filter(f => !!f && !f.startsWith(','));
    this.router.navigate([], {
      queryParams: { sort: sort.length ? sort : null, pageNumber: null },
      queryParamsHandling: 'merge',
      replaceUrl: this.replace,
    });
    this.replace ||= !!sort.length;
  }

  title(value: string) {
    for (const s of this.allSorts) {
      if (s.value === value) return s.title || '';
    }
    return '';
  }

  sortCol(sort: string) {
    if (!sort.includes(',')) return sort;
    return sort.split(',')[0];
  }

  sortDir(sort: string) {
    if (!sort.includes(',')) return defaultDesc(sort) ? 'DESC' : 'ASC';
    return sort.split(',')[1].toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  }
}
