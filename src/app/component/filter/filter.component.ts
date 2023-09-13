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
import { RootConfig } from '../../mods/root';
import { UserConfig } from '../../mods/user';
import { BookmarkService } from '../../service/bookmark.service';
import { hasPrefix } from '../../util/tag';
import { KanbanConfig } from '../../mods/kanban';

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
  set activeExts(value: Ext[]) {
    if (value.length) this.type = 'ref';
  }

  @Input()
  set type(value: Type) {
    if (value === 'ref') {
      this.allFilters = [];
      for (const ext of this.store.view.exts) {
        for (const f of [...ext.config?.queryFilters || [], ...ext.config?.responseFilters || []]) {
          this.loadFilter({
            group: ext.name || ext.tag,
            ...f,
          });
        }
      }
      for (const f of this.admin.filters) this.loadFilter(f);
      this.pushFilter({
        label: $localize`Filters 🕵️️`,
        filters : [
          { filter: 'untagged', label: $localize`🏷️⃠ untagged` },
          { filter: 'uncited', label: $localize`💌️⃠ uncited` },
          { filter: 'unsourced', label: $localize`📜️⃠ unsourced` },
          { filter: 'obsolete', label: $localize`⏮️ obsolete` },
          { filter: 'query/internal', label: $localize`⚙️ internal` },
        ],
      }, {
        label: $localize`Time ⏱️`,
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
      for (const e of this.kanbanExts) {
        const group = $localize`Kanban 📋️`;
        const k = e.config! as KanbanConfig;
        if (k.columns?.length) {
          this.allFilters.push({
            label: group,
            filters: [],
          });
          this.exts.getCachedExts(k.columns, e.origin || '').subscribe(exts => {
            if (k.showColumnBacklog) {
              this.loadFilter({
                group,
                label: k.columnBacklogTitle || $localize`🚫️ no column`,
                query: exts.map(e => '!' + e.tag).join(':'),
              });
            }
            for (const e of exts) {
              this.loadFilter({
                group,
                label: e.name || e.tag,
                query: e.tag,
              });
            }
            if (k.swimLanes) {
              this.exts.getCachedExts(k.swimLanes, e.origin || '').subscribe(exts => {
                for (const e of exts) {
                  this.loadFilter({
                    group,
                    label: e.name || e.tag,
                    query: e.tag,
                  });
                }
                if (k.showSwimLaneBacklog) {
                  this.loadFilter({
                    group,
                    label: k.swimLaneBacklogTitle || $localize`🚫️ no swim lane`,
                    query: exts.map(e => '!' + e.tag).join(':'),
                  });
                }
              });
            }
            if (k.badges?.length) {
              this.exts.getCachedExts(k.badges, e.origin || '').subscribe(exts => {
                for (const e of exts) {
                  this.loadFilter({
                    group: group,
                    label: e.name || e.tag,
                    query: e.tag,
                  });
                }
                this.loadFilter({
                  group: group,
                  label: $localize`🚫️ no badges`,
                  query: exts.map(e => '!' + e.tag).join(':'),
                });
              });
            }
          });
        }
      }
    } else {
      this.allFilters = [
        { label: $localize`Time ⏱️`,
          filters : [
            this.modifiedBeforeFilter,
            this.modifiedAfterFilter,
          ],
        },
      ];
    }
    this.syncDates();
  }

  get rootConfigs() {
    if (!this.admin.status.templates.root) return [];
    return this.store.view.exts.map(x => x.config).filter(c => !!c) as RootConfig[];
  }

  get userConfigs() {
    if (!this.admin.status.templates.user) return [];
    return this.store.view.exts
        .filter(x => hasPrefix(x.tag, 'user'))
        .map(x => x.config).filter(c => !!c) as UserConfig[];
  }

  get kanbanExts() {
    if (!this.admin.status.templates.kanban) return [];
    return this.store.view.exts
        .filter(x => hasPrefix(x.tag, 'kanban'))
        .filter(x => x.config);
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
    this.bookmarks.filters = filter(this.filters, f => !!f);
  }

  toIso(date: string) {
    return moment(date, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS).toISOString();
  }

  toDate(filter: string) {
    if (filter.includes('/')) filter = filter.substring(filter.lastIndexOf('/') + 1);
    return moment(filter).format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS);
  }

}
