import { Component, computed, ElementRef, inject, input, linkedSignal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { isEqual, uniq } from 'lodash-es';
import { filter, startWith, switchMap } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { EditorService } from '../../service/editor.service';
import { Store } from '../../store/store';
import { Type } from '../../store/view';
import { columnLabel, columnTags, convertSort, defaultDesc, SortItem, validSortColumn } from '../../util/query';

@Component({
  selector: 'app-sort',
  templateUrl: './sort.component.html',
  styleUrls: ['./sort.component.scss'],
  host: { 'class': 'sort form-group' },
  imports: [ReactiveFormsModule, FormsModule]
})
export class SortComponent {
  router = inject(Router);
  admin = inject(AdminService);
  store = inject(Store);
  private editor = inject(EditorService);

  readonly create = viewChild<ElementRef<HTMLSelectElement>>('create');

  readonly type = input<Type>('ref');

  readonly allRefSorts = computed(() => this.admin.refSorts().map(convertSort));
  readonly allTagSorts = computed(() => this.admin.tagSorts()
    .filter(s => this.type() !== 'ref' && validSortColumn(this.type(), s?.sort))
    .map(convertSort));
  readonly sorts = linkedSignal(() => {
    const sort = this.store.view.sort();
    return Array.isArray(sort) ? [...sort] : [sort];
  });
  private readonly tagNames = toSignal(toObservable(computed(() => uniq(this.sorts().flatMap(s => columnTags(this.sortCol(s || '')))), { equal: isEqual })).pipe(
    switchMap(tags => this.editor.getTagNames(tags, this.store.account.origin()).pipe(startWith(new Map<string, string>()))),
  ), { initialValue: new Map<string, string>() });
  private readonly menuSorts = computed(() => this.type() === 'ref'
    ? [...this.store.view.isSearch() ? [{ value: 'rank', label: $localize`🔍️ relevance`, title: $localize`Search rank` }] : [], ...this.allRefSorts()]
    : this.allTagSorts());
  /**
   * Sorts from the menu, plus sorts only in the URL with a generated label.
   */
  readonly allSorts = computed(() => {
    const names = this.tagNames();
    const name = (tag: string) => names.get(tag) || this.admin.getPlugin(tag)?.name || this.admin.getTemplate(tag)?.name;
    const urlOnly = uniq(this.sorts().map(s => this.sortCol(s || '')))
      .filter(col => validSortColumn(this.type(), col) && !this.menuSorts().some(s => s.value === col))
      .map(col => ({ value: col, label: columnLabel(col, name) }) as SortItem);
    return [...this.menuSorts(), ...urlOnly];
  });

  replace = false;

  constructor() {
    const router = this.router;

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
