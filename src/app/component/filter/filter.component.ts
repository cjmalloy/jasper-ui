import { Component, ElementRef, HostBinding, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { filter, find, pullAll } from 'lodash-es';
import { autorun, IReactionDisposer, toJS } from 'mobx';
import * as moment from 'moment';
import { Ext } from '../../model/ext';
import { Filter } from '../../model/ref';
import { FilterConfig } from '../../model/tag';
import { KanbanConfig } from '../../mods/kanban';
import { RootConfig } from '../../mods/root';
import { UserConfig } from '../../mods/user';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { AuthzService } from '../../service/authz.service';
import { BookmarkService } from '../../service/bookmark.service';
import { Store } from '../../store/store';
import { Type } from '../../store/view';
import { emoji } from '../../util/emoji';
import { toggle, UrlFilter } from '../../util/query';
import { hasPrefix } from '../../util/tag';

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

  emoji = emoji('🪄️') || '🔍️';

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
      this.sync();
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
          { filter: 'untagged', label: $localize`🚫️🏷️ untagged` },
          { filter: 'uncited', label: $localize`🚫️💌️ uncited` },
          { filter: 'unsourced', label: $localize`🚫️📜️ unsourced` },
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
    this.sync();
  }

  get rootConfigs() {
    if (!this.admin.getTemplate('')) return [];
    return this.store.view.exts.map(x => x.config).filter(c => !!c) as RootConfig[];
  }

  get userConfigs() {
    if (!this.admin.getTemplate('user')) return [];
    return this.store.view.exts
        .filter(x => hasPrefix(x.tag, 'user'))
        .map(x => x.config).filter(c => !!c) as UserConfig[];
  }

  get kanbanExts() {
    if (!this.admin.getTemplate('kanban')) return [];
    return this.store.view.exts
        .filter(x => hasPrefix(x.tag, 'kanban'))
        .filter(x => x.config);
  }

  sync() {
    const setToggles: UrlFilter[] = [];
    for (const f of this.filters) {
      if (f.startsWith('modified/before')) {
        this.modifiedBeforeFilter.filter = f;
      } else if (f.startsWith('modified/after')) {
        this.modifiedAfterFilter.filter = f;
      } else if (f.startsWith('response/before')) {
        this.responseBeforeFilter.filter = f;
      } else if (f.startsWith('response/after')) {
        this.responseAfterFilter.filter = f;
      } else if (f.startsWith('published/before')) {
        this.publishedBeforeFilter.filter = f;
      } else if (f.startsWith('published/after')) {
        this.publishedAfterFilter.filter = f;
      } else if (f.startsWith('created/before')) {
        this.createdBeforeFilter.filter = f;
      } else if (f.startsWith('created/after')) {
        this.createdAfterFilter.filter = f;
      } else if (!this.allFilters.find(g => g.filters.find(i => i.filter === f))) {
        // Current filter is missing
        if (f.startsWith('query/')) setToggles.push(f);
        if (f.startsWith('scheme/')) this.loadFilter({ group: $localize`Schemes 🏳️️`, scheme: f.substring('scheme/'.length)});
        if (f.startsWith('plugin/')) this.loadFilter({ group: $localize`Plugins 🧰️`, response: f as any });
      }
    }
    for (const f of setToggles) {
      const set = this.allFilters.filter(g => g.filters.find(i => i.filter === toggle(f)));
      if (set.length) {
        set.forEach(g => {
          // Toggle all negated versions of this filter
          const target = g.filters.find(i => i.filter === toggle(f));
          if (target) {
            target.filter = f;
            if (f.startsWith('query/!')) {
              target.label = this.store.account.querySymbol('!') + target.label;
            } else {
              target.label = target.label.substring(this.store.account.querySymbol('!').length);
            }
          }
        });
      } else {
        this.loadFilter({ group: $localize`Queries 🔎️️`, query: f.substring('query/'.length)});
      }
    }
    this.filters = pullAll(this.filters, setToggles.map(toggle));
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
      return { filter: `scheme/${filter.scheme}`, label: filter.label || filter.scheme };
    } else if (filter.query) {
      return { filter: `query/${filter.query}`, label: filter.label || filter.query };
    } else if (filter.response) {
      return { filter: filter.response, label: filter.label || filter.response };
    }
    throw 'Can\'t convert filter';
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

  toggleQuery(index: number) {
    this.filters[index] = toggle(this.filters[index])!;
    this.setFilters();
  }

  setModified(index: number, before: boolean, isoDate: string) {
    this.filters[index] = `modified/${before ? 'before' : 'after'}/${isoDate}`;
    this.sync();
    this.setFilters();
  }

  setResponse(index: number, before: boolean, isoDate: string) {
    this.filters[index] = `response/${before ? 'before' : 'after'}/${isoDate}`;
    this.sync();
    this.setFilters();
  }

  setPublished(index: number, before: boolean, isoDate: string) {
    this.filters[index] = `published/${before ? 'before' : 'after'}/${isoDate}`;
    this.sync();
    this.setFilters();
  }

  setCreated(index: number, before: boolean, isoDate: string) {
    this.filters[index] = `created/${before ? 'before' : 'after'}/${isoDate}`;
    this.sync();
    this.setFilters();
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
