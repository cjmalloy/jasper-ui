import { ChangeDetectionStrategy, Component, effect, ElementRef, input, signal, untracked, viewChild } from '@angular/core';
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

  allRefSorts = this.admin.refSorts.map(convertSort);
  allTagSorts = this.admin.tagSorts.map(convertSort);
  readonly allSorts = signal<SortItem[]>([
    { value: 'modified', label: $localize`🕓️ modified` },
    { value: 'origin:len', label: $localize`🪆 nesting` },
  ]);
  readonly sorts = signal<string[]>([], { equal: () => false });

  replace = false;

  constructor(
    public router: Router,
    public admin: AdminService,
    public store: Store,
  ) {
    effect(() => {
      const sort = this.store.view.sort;
      untracked(() => this.sorts.set(Array.isArray(sort) ? [...sort] : [sort]));
    });
    effect(() => {
      const isSearch = this.store.view.isSearch;
      const type = this.type();
      untracked(() => this.rebuildSorts(type, isSearch));
    });
    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
    ).subscribe(() => this.replace = false);
  }

  private rebuildSorts(type: Type, isSearch: boolean) {
    if (type === 'ref') {
      this.allSorts.set([...this.allRefSorts]);
      if (isSearch) {
        this.allSorts().unshift({ value: 'rank', label: $localize`🔍️ relevance`, title: $localize`Search rank` });
      }
    } else {
      this.allSorts.set([...this.allTagSorts]);
    }
  }

  addSort(value: string) {
    this.replace = false;
    if (!this.sorts()) this.sorts.set([]);
    this.sorts().push('');
    this.sorts.set(this.sorts());
    this.create()!.nativeElement.selectedIndex = 0;
    this.setSortCol(this.sorts().length - 1, value);
  }

  setSortCol(index: number, value: string) {
    const dir = this.sortDir(value)
    this.sorts()[index] = value + ',' + dir;
    this.sorts.set(this.sorts());
    this.setSort();
  }

  setSortDir(index: number, value: string) {
    const col = this.sortCol(this.sorts()[index])
    this.sorts()[index] = col + ',' + value;
    this.sorts.set(this.sorts());
    if (col) this.setSort();
  }

  removeSort(index: number) {
    this.replace = false;
    this.sorts().splice(index, 1);
    this.sorts.set(this.sorts());
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
