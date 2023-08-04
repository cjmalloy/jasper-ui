import { Component, ElementRef, HostBinding, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { filter, find } from 'lodash-es';
import { autorun, IReactionDisposer, toJS } from 'mobx';
import * as moment from 'moment';
import { Filter } from '../../model/ref';
import { FilterConfig } from '../../model/tag';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';
import { Store } from '../../store/store';
import { Type } from '../../store/view';
import { UrlFilter } from '../../util/query';
import { Ext } from '../../model/ext';
import { ExtService } from '../../service/api/ext.service';
import { RootConfig } from '../../template/root';
import { KanbanConfig } from '../../template/kanban';
import { UserConfig } from '../../template/user';
import { BookmarkService } from '../../service/bookmark.service';

type FilterItem = { filter: UrlFilter, label: string, time?: boolean };
type FilterGroup = { filters: FilterItem[], label: string };

@Component({
  selector: 'app-filter',
  templateUrl: './filter.component.html',
  styleUrls: ['./filter.component.scss']
})
export class FilterComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'filter form-group';

  private disposers: IReactionDisposer[] = [];

  @ViewChild('create')
  create?: ElementRef<HTMLSelectElement>;

  modifiedBeforeFilter: FilterItem = { filter: `modified/before/${moment().toISOString()}`, label: $localize`🕓️ modified before` };
  modifiedAfterFilter: FilterItem = { filter: `modified/after/${moment().toISOString()}`, label: $localize`🕓️ modified after` };
  responseBeforeFilter: FilterItem = { filter: `response/before/${moment().toISOString()}`, label: $localize`🧵️ response before` };
  responseAfterFilter: FilterItem = { filter: `response/after/${moment().toISOString()}`, label: $localize`🧵️ response after` };
  publishedBeforeFilter: FilterItem = { filter: `published/before/${moment().toISOString()}`, label: $localize`📅️ published before` };
  publishedAfterFilter: FilterItem = { filter: `published/after/${moment().toISOString()}`, label: $localize`📅️ published after` };
  createdBeforeFilter: FilterItem = { filter: `created/before/${moment().toISOString()}`, label: $localize`✨️ created before` };
  createdAfterFilter: FilterItem = { filter: `created/after/${moment().toISOString()}`, label: $localize`✨️ created after` };
  allFilters: FilterGroup[] = [];

  filters: UrlFilter[] = [];

  constructor(
    public router: Router,
    public admin: AdminService,
    public store: Store,
    private exts: ExtService,
    private auth: AuthzService,
    private bookmarks: BookmarkService,
  ) {
    this.disposers.push(autorun(() => {
      this.filters = toJS(this.store.view.filter);
      if (!Array.isArray(this.filters)) this.filters = [this.filters];
      this.syncDates();
    }));
  }

  @Input()
  set ext(value: Ext | undefined) {
    if (value) this.type = 'ref';
  }

  @Input()
  set type(value: Type) {
    if (value === 'ref') {
      this.allFilters = [];
      for (const f of this.rootConfig?.queryFilters || []) this.loadFilter({
        group: this.store.view.ext!.name || this.store.view.ext!.tag,
        ...f,
      });
      for (const f of this.rootConfig?.responseFilters || []) this.loadFilter({
        group: this.store.view.ext!.name || this.store.view.ext!.tag,
        ...f,
      });
      for (const f of this.admin.filters) this.loadFilter(f);
      this.pushFilter({
        label: $localize`Filters`,
        filters : [
          { filter: 'untagged', label: $localize`🏷️⃠ untagged` },
          { filter: 'uncited', label: $localize`💌️⃠ uncited` },
          { filter: 'unsourced', label: $localize`📜️⃠ unsourced` },
          { filter: 'query/internal', label: $localize`🕵️️ internal` },
        ],
      }, {
        label: $localize`Time`,
        filters : [
          this.modifiedBeforeFilter,
          this.modifiedAfterFilter,
          this.responseBeforeFilter,
          this.responseAfterFilter,
          this.publishedBeforeFilter,
          this.publishedAfterFilter,
          this.createdBeforeFilter,
          this.createdAfterFilter,
        ],
      });
      if (this.kanbanConfig?.badges?.length) {
        this.allFilters.push({
          label: $localize`Badges`,
          filters: [],
        });
        this.exts.getCachedExts(this.kanbanConfig?.badges).subscribe(exts => {
          for (const e of exts) {
            this.loadFilter({
              group: $localize`Badges`,
              label: e.name || e.tag,
              query: e.tag,
            });
          }
          this.loadFilter({
            group: $localize`Badges`,
            label: $localize`🚫️ no badges`,
            query: exts.map(e => '!' + e.tag).join(':'),
          });
        });
      }
      if (this.kanbanConfig?.columns?.length) {
        this.allFilters.push({
          label: $localize`Kanban`,
          filters: [],
        });
        this.exts.getCachedExts(this.kanbanConfig?.columns).subscribe(exts => {
          for (const e of exts) {
            this.loadFilter({
              group: $localize`Kanban`,
              label: e.name || e.tag,
              query: e.tag,
            });
          }
          if (this.kanbanConfig?.showNoColumn) {
            this.loadFilter({
              group: $localize`Kanban`,
              label: $localize`🚫️ no column`,
              query: exts.map(e => '!' + e.tag).join(':'),
            });
          }
          if (this.kanbanConfig?.swimLanes) {
            this.exts.getCachedExts(this.kanbanConfig?.swimLanes).subscribe(exts => {
              for (const e of exts) {
                this.loadFilter({
                  group: $localize`Kanban`,
                  label: e.name || e.tag,
                  query: e.tag,
                });
              }
              if (this.kanbanConfig?.showNoSwimLane) {
                this.loadFilter({
                  group: $localize`Kanban`,
                  label: $localize`🚫️ no swim lane`,
                  query: exts.map(e => '!' + e.tag).join(':'),
                });
              }
            });
          }
        });
      }
    } else {
      this.allFilters = [
        { label: $localize`Time`,
          filters : [
            this.modifiedBeforeFilter,
            this.modifiedAfterFilter,
          ],
        },
      ];
      for (const f of this.admin.tagFilters) this.loadFilter(f);
    }
    this.syncDates();
  }

  get rootConfig() {
    if (!this.admin.status.templates.root) return undefined;
    return this.store.view.ext?.config as RootConfig;
  }

  get userConfig() {
    if (!this.admin.status.templates.user) return undefined;
    return this.store.view.ext?.config as UserConfig;
  }

  get kanbanConfig() {
    if (!this.admin.status.templates.kanban) return undefined;
    return this.store.view.ext?.config as KanbanConfig;
  }

  loadFilter(filter: FilterConfig) {
    if (!filter.scheme && !this.auth.queryReadAccess(filter.query || filter.response)) return;
    let group = find(this.allFilters, f => f.label === (filter.group || ''));
    if (group) {
      group.filters.push(this.convertFilter(filter));
    } else {
      this.allFilters.push({
        label: filter.group || '',
        filters: [this.convertFilter(filter)],
      });
    }
  }

  pushFilter(...fgs: FilterGroup[]) {
    for (const fg of fgs) {
      let group = find(this.allFilters, f => f.label === (fg.label || ''));
      if (group) {
        group.filters.push(...fg.filters);
      } else {
        this.allFilters.push(fg);
      }
    }
  }

  convertFilter(filter: FilterConfig): FilterItem {
    if (filter.scheme) {
      return { filter: `scheme/${filter.scheme}`, label: filter.label || '' };
    } else if (filter.query) {
      return { filter: `query/${filter.query}`, label: filter.label || '' };
    } else {
      return { filter: filter.response!, label: filter.label || '' };
    }
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  addFilter(value: Filter) {
    if (value) {
      if (!this.filters) this.filters = [];
      this.filters.push(value);
      this.create!.nativeElement.selectedIndex = 0;
      this.setFilters();
    }
  }

  setFilter(index: number, value: Filter) {
    this.filters[index] = value;
    this.setFilters();
  }

  setModified(index: number, before: boolean, isoDate: string) {
    this.filters[index] = `modified/${before ? 'before' : 'after'}/${isoDate}`;
    this.syncDates();
    this.setFilters();
  }

  setResponse(index: number, before: boolean, isoDate: string) {
    this.filters[index] = `response/${before ? 'before' : 'after'}/${isoDate}`;
    this.syncDates();
    this.setFilters();
  }

  setPublished(index: number, before: boolean, isoDate: string) {
    this.filters[index] = `published/${before ? 'before' : 'after'}/${isoDate}`;
    this.syncDates();
    this.setFilters();
  }

  setCreated(index: number, before: boolean, isoDate: string) {
    this.filters[index] = `created/${before ? 'before' : 'after'}/${isoDate}`;
    this.syncDates();
    this.setFilters();
  }

  syncDates() {
    for (const f of this.filters) {
      if (f.startsWith('modified/before')) {
        this.modifiedBeforeFilter.filter = f;
      }
      if (f.startsWith('modified/after')) {
        this.modifiedAfterFilter.filter = f;
      }
      if (f.startsWith('response/before')) {
        this.responseBeforeFilter.filter = f;
      }
      if (f.startsWith('response/after')) {
        this.responseAfterFilter.filter = f;
      }
      if (f.startsWith('published/before')) {
        this.publishedBeforeFilter.filter = f;
      }
      if (f.startsWith('published/after')) {
        this.publishedAfterFilter.filter = f;
      }
      if (f.startsWith('created/before')) {
        this.createdBeforeFilter.filter = f;
      }
      if (f.startsWith('created/after')) {
        this.createdAfterFilter.filter = f;
      }
    }
  }

  removeFilter(index: number) {
    this.filters.splice(index, 1);
    this.setFilters();
  }

  setFilters() {
    const filters = filter(this.filters, f => !!f);
    this.bookmarks.setFilters(filters);
  }

  toIso(date: string) {
    return moment(date, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS).toISOString();
  }

  toDate(filter: string) {
    if (filter.includes('/')) filter = filter.substring(filter.lastIndexOf('/') + 1);
    return moment(filter).format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS);
  }

}
