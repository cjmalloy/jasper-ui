import { Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { autorun, IReactionDisposer, toJS } from 'mobx';
import { filter } from 'rxjs';
import { RefSort } from '../../model/ref';
import { TagSort } from '../../model/tag';
import { AdminService } from '../../service/admin.service';
import { Store } from '../../store/store';
import { Type } from '../../store/view';
import { defaultDesc } from '../../util/query';

export const allRefSorts: {value: RefSort, label: string, title?: string }[] = [
  { value: 'created', label: $localize`✨️ new` },
  { value: 'published', label: $localize`📅️ published` },
  { value: 'modified', label: $localize`🕓️ modified` },
  { value: 'metadataModified', label: $localize`🧵️ new response`, title: $localize`Date of new response` },
  { value: 'title', label: $localize`🇦️ title` },
  { value: 'url', label: $localize`🔗️ url` },
  { value: 'scheme', label: $localize`🏳️️ scheme` },
  { value: 'origin', label: $localize`🏛️ origin` },
  { value: 'nesting', label: $localize`🪆 nesting` },
  { value: 'tagCount', label: $localize`🏷️ tags`, title: $localize`Number of tags` },
  { value: 'responseCount', label: $localize`💌️ responses`, title: $localize`Number of responses` },
  { value: 'sourceCount', label: $localize`📜️ sources`, title: $localize`Number of sources` },
];

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

  allSorts: {value: RefSort | TagSort, label: string, title?: string}[] = [
    { value: 'modified', label: $localize`🕓️ modified` },
    { value: 'nesting', label: $localize`🪆 nesting` },
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
        this.allSorts = [...allRefSorts];
        if (this.admin.getPlugin('plugin/comment')) {
          this.allSorts.splice(7, 0, { value: 'commentCount', label: $localize`💬️ comments`, title: $localize`Number of comments` });
        }
        if (this.admin.getPlugin('plugin/user/vote/up')) {
          this.allSorts.splice(0, 0, { value: 'voteCount', label: '❤️ top', title: $localize`Total activity` });
          if (this.admin.getPlugin('plugin/user/vote/down')) {
            this.allSorts.splice(0, 0, { value: 'voteScore', label: '📈️ score', title: $localize`Total score` });
          }
          this.allSorts.splice(0, 0, { value: 'voteScoreDecay', label: '🔥️ hot', title: $localize`Decaying score` });
        }
        if (this.store.view.search) {
          this.allSorts.unshift({ value: 'rank', label: $localize`🔍️ relevance`, title: $localize`Search rank` });
        }
      } else {
        this.allSorts = [
          { value: 'modified', label: $localize`🕓️ modified` },
          { value: 'name', label: $localize`🇦️ name` },
          { value: 'tag', label: $localize`🏷️ tag` },
          { value: 'levels', label: $localize`/🏷️ level`, title: $localize`Number of subtags` },
          { value: 'origin', label: $localize`🏛️ origin` },
          { value: 'nesting', label: $localize`🪆 nesting` },
        ]
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
    if (!sort.includes(',')) return defaultDesc.includes(sort) ? 'DESC' : 'ASC';
    return sort.split(',')[1].toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  }
}
