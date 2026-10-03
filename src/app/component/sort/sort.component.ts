import { ChangeDetectionStrategy, Component, computed, ElementRef, input, linkedSignal, viewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormsModule]
})
export class SortComponent {
  readonly create = viewChild<ElementRef<HTMLSelectElement>>('create');

  readonly type = input<Type>('ref');

  readonly allRefSorts = computed(() => this.admin.refSorts().map(convertSort));
  readonly allTagSorts = computed(() => this.admin.tagSorts().map(convertSort));
  readonly allSorts = computed(() => this.type() === 'ref'
    ? [...this.store.view.isSearch() ? [{ value: 'rank', label: $localize`🔍️ relevance`, title: $localize`Search rank` }] : [], ...this.allRefSorts()]
    : this.allTagSorts());
  readonly sorts = linkedSignal(() => {
    const sort = this.store.view.sort();
    return Array.isArray(sort) ? [...sort] : [sort];
  });

  replace = false;

  constructor(
    public router: Router,
    public admin: AdminService,
    public store: Store,
  ) {
    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
    ).subscribe(() => this.replace = false);
  }

  addSort(value: string) {
    this.replace = false;
    this.sorts.update(sorts => [...sorts || [], '']);
    this.create()!.nativeElement.selectedIndex = 0;
    this.setSortCol(this.sorts().length - 1, value);
  }

  setSortCol(index: number, value: string) {
    const dir = this.sortDir(value)
    this.sorts.update(sorts => sorts.map((s, i) => i === index ? value + ',' + dir : s));
    this.setSort();
  }

  setSortDir(index: number, value: string) {
    const col = this.sortCol(this.sorts()[index])
    this.sorts.update(sorts => sorts.map((s, i) => i === index ? col + ',' + value : s));
    if (col) this.setSort();
  }

  removeSort(index: number) {
    this.replace = false;
    this.sorts.update(sorts => sorts.filter((s, i) => i !== index));
    this.setSort();
  }

  setSort() {
    const sort = this.sorts().filter(f => !!f && !f.startsWith(','));
    this.router.navigate([], {
      queryParams: { sort: sort.length ? sort : null, pageNumber: null },
      queryParamsHandling: 'merge',
      replaceUrl: this.replace,
    });
    this.replace ||= !!sort.length;
  }

  title(value: string) {
    for (const s of this.allSorts()) {
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
