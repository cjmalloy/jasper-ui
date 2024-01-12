import { Component, ElementRef, HostBinding, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { filter, find, pullAll, uniq } from 'lodash-es';
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
export class FilterComponent implements OnChanges, OnDestroy {
  @HostBinding('class') css = 'filter form-group';

  private disposers: IReactionDisposer[] = [];

  @ViewChild('create')
  create?: ElementRef<HTMLSelectElement>;

  @Input()
  activeExts: Ext[] = [];
  @Input()
  type?: Type;

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

  ngOnChanges(changes: SimpleChanges) {
    if (changes.activeExts || changes.type) {
      if (this.type === 'ref') {
        this.allFilters = [];
        for (const ext of this.activeExts) {
          for (const f of [...ext.config?.queryFilters || [], ...ext.config?.responseFilters || []]) {
            this.loadFilter({
              group: ext.name || this.admin.getPlugin(ext.tag)?.name || this.admin.getTemplate(ext.tag)?.name || ext.tag,
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
            const kanbanTags = uniq([
              ...k.columns,
              ...k.swimLanes || [],
              ...k.badges || []
            ]);
            this.exts.getCachedExts(kanbanTags, e.origin || '').subscribe(exts => {
              for (const e of exts) {
                this.loadFilter({
                  group,
                  label: e.name || e.tag,
                  query: e.tag,
                });
              }
              if (k.columns?.length && k.showColumnBacklog) {
                this.loadFilter({
                  group,
                  label: k.columnBacklogTitle || $localize`🚫️ no column`,
                  query: (k.columns || []).map(t => '!' + t).join(':'),
                });
              }
              if (k.swimLanes?.length && k.showSwimLaneBacklog) {
                this.loadFilter({
                  group,
                  label: k.swimLaneBacklogTitle || $localize`🚫️ no swim lane`,
                  query: k.swimLanes!.map(t => '!' + t).join(':'),
                });
              }
              if (k.badges?.length) {
                this.loadFilter({
                  group: group,
                  label: $localize`🚫️ no badges`,
                  query: k.badges.map(t => '!' + t).join(':'),
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
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get rootConfigs() {
    if (!this.admin.getTemplate('')) return [];
    return this.activeExts.map(x => x.config).filter(c => !!c) as RootConfig[];
  }

  get userConfigs() {
    if (!this.admin.getTemplate('user')) return [];
    return this.activeExts
        .filter(x => hasPrefix(x.tag, 'user'))
        .map(x => x.config).filter(c => !!c) as UserConfig[];
  }

  get kanbanExts() {
    if (!this.admin.getTemplate('kanban')) return [];
    return this.activeExts
        .filter(x => hasPrefix(x.tag, 'kanban'))
        .filter(x => x.config);
  }

  /**
   * Update list of available filters to match current filter set so that the
   * select dropdown values match and it remains selected.
   *
   * For date-time filters, update the date-time to match the current query.
   *
   * For query filters, update the current toggled (negation) status.
   *
   * If a filter can't be matched, just add it to the allFilters list.
   */
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
        if (f.startsWith('sources/')) this.loadFilter({ group: $localize`Filters 🕵️️`, label: $localize`Sources ⤴️`, sources: f.substring('sources/'.length) });
        if (f.startsWith('responses/')) this.loadFilter({ group: $localize`Filters 🕵️️`, label: $localize`Responses ⤵️`, responses: f.substring('responses/'.length) });
        if (f.startsWith('plugin/')) this.loadFilter({ group: $localize`Plugins 🧰️`, response: f as any });
      }
    }
    // Search all filters for the toggled (negated) version and sync it
    for (const f of setToggles) {
      const set = this.allFilters.filter(g => g.filters.find(i => i.filter === toggle(f)));
      if (set.length) {
        set.forEach(g => {
          // Toggle all negated versions of this filter
          const target = g.filters.find(i => i.filter === toggle(f));
          if (target) {
            target.filter = f;
            if (f.startsWith('query/!(')) {
              target.label = this.store.account.querySymbol('!') + target.label;
            } else {
              target.label = target.label.substring(this.store.account.querySymbol('!').length);
            }
          }
        });
      } else {
        // TODO: On page load Kanaban Exts are not loaded in time to find proper negate query filter
        this.loadFilter({ group: $localize`Queries 🔎️️`, query: f.substring('query/'.length)});
      }
    }
    this.filters = pullAll(this.filters, setToggles.map(toggle));
  }

  loadFilter(filter: FilterConfig) {
    if ((filter.query || filter.response) && !this.auth.queryReadAccess(filter.query || filter.response)) return;
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
    if (filter.sources) {
      return { filter: `sources/${filter.sources}`, label: filter.label || filter.sources };
    } else if (filter.responses) {
      return { filter: `responses/${filter.responses}`, label: filter.label || filter.responses };
    } else if (filter.scheme) {
      return { filter: `scheme/${filter.scheme}`, label: filter.label || filter.scheme };
    } else if (filter.query) {
      return { filter: `query/${filter.query}`, label: filter.label || filter.query };
    } else if (filter.response) {
      return { filter: filter.response, label: filter.label || filter.response };
    }
    throw 'Can\'t convert filter';
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
