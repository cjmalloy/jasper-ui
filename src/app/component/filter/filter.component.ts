import { Component, effect, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { filter, find, pullAll, uniq } from 'lodash-es';
import { DateTime } from 'luxon';
import { Ext } from '../../model/ext';
import { FilterConfig } from '../../model/tag';
import { KanbanConfig } from '../../mods/org/kanban';
import { RootConfig } from '../../mods/root';
import { UserConfig } from '../../mods/user';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';
import { BookmarkService } from '../../service/bookmark.service';
import { EditorService } from '../../service/editor.service';
import { Store } from '../../store/store';
import { Type } from '../../store/view';
import { emoji } from '../../util/emoji';
import { convertFilter, FilterGroup, FilterItem, negatable, toggle, UrlFilter } from '../../util/query';
import { hasPrefix } from '../../util/tag';

@Component({
  selector: 'app-filter',
  templateUrl: './filter.component.html',
  styleUrls: ['./filter.component.scss'],
  host: { 'class': 'filter form-group' },
  imports: [ReactiveFormsModule, FormsModule]
})
export class FilterComponent implements OnChanges {

  @ViewChild('create')
  create?: ElementRef<HTMLSelectElement>;

  @Input()
  activeExts: Ext[] = [];
  @Input()
  type?: Type;

  modifiedBeforeFilter: FilterItem = { filter: `modified/before/${DateTime.now().toISO()}`, label: $localize`🕓️ modified before` };
  modifiedAfterFilter: FilterItem = { filter: `modified/after/${DateTime.now().toISO()}`, label: $localize`🕓️ modified after` };
  responseBeforeFilter: FilterItem = { filter: `response/before/${DateTime.now().toISO()}`, label: $localize`🧵️ response before` };
  responseAfterFilter: FilterItem = { filter: `response/after/${DateTime.now().toISO()}`, label: $localize`🧵️ response after` };
  publishedBeforeFilter: FilterItem = { filter: `published/before/${DateTime.now().toISO()}`, label: $localize`📅️ published before` };
  publishedAfterFilter: FilterItem = { filter: `published/after/${DateTime.now().toISO()}`, label: $localize`📅️ published after` };
  createdBeforeFilter: FilterItem = { filter: `created/before/${DateTime.now().toISO()}`, label: $localize`✨️ created before` };
  createdAfterFilter: FilterItem = { filter: `created/after/${DateTime.now().toISO()}`, label: $localize`✨️ created after` };

  allFilters: FilterGroup[] = [];
  filters: UrlFilter[] = [];

  emoji = emoji($localize`🪄️`) || $localize`🔍️`;

  constructor(
    public router: Router,
    public admin: AdminService,
    public store: Store,
    private auth: AuthzService,
    private bookmarks: BookmarkService,
    private editor: EditorService,
  ) {
    effect(() => {
      this.filters = this.store.view.filter;
      if (!Array.isArray(this.filters)) this.filters = [this.filters];
      this.sync();
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.activeExts || changes.type) {
      if (this.type === 'ref') {
        this.allFilters = [];
        for (const ext of this.activeExts) {
          for (const f of [...ext.config?.queryFilters || [], ...ext.config?.responseFilters || []]) {
            this.loadFilter({
              group: ext.name || this.admin.getPlugin(ext.tag)?.name || this.admin.getTemplate(ext.tag)?.name || '#' + ext.tag,
              ...f,
            });
          }
        }
        this.pushFilter({
          label: $localize`Queries 🔎️️`, filters: [],
        }, {
          label: $localize`Media 🎬️`, filters: [],
        }, {
          label: $localize`Games 🕹️`, filters: [],
        }, {
          label: $localize`Time ⏱️`,
          filters: [
            this.modifiedBeforeFilter,
            this.modifiedAfterFilter,
            this.responseBeforeFilter,
            this.responseAfterFilter,
            this.publishedBeforeFilter,
            this.publishedAfterFilter,
            this.createdBeforeFilter,
            this.createdAfterFilter,
          ],
        }, {
          label: $localize`Filters 🕵️️`, filters: [],
        }, {
          label: $localize`Delta Δ`, filters: [],
        }, {
          label: $localize`Mod Tools 🛡️`, filters: [],
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
            this.editor.getTagsPreview(kanbanTags, e.origin || '').subscribe(ps => {
              for (const p of ps) {
                this.loadFilter({
                  group,
                  label: p.name || '#' + p.tag,
                  query: p.tag,
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
        this.pushFilter({
          label: $localize`Plugins 🧰️`, filters: [],
        }, {
          label: $localize`Schemes 🏳️️`, filters: [],
        }, {
          label: $localize`Templates 🎨️`, filters: [],
        });
        for (const f of this.admin.filters) this.loadFilter(f);
        this.pushFilter({
          label: $localize`Filters 🕵️️`,
          filters: [
            { filter: 'obsolete', label: $localize`⏮️ obsolete`, title: $localize`Show older versions` },
            { filter: 'query/_plugin:!+user', label: $localize`📟️ system`, title: $localize`System configs` },
          ],
        });
      } else {
        this.allFilters = [];
        this.pushFilter({
          label: $localize`Time ⏱️`,
          filters : [
            this.modifiedBeforeFilter,
            this.modifiedAfterFilter,
          ],
        });
        if (this.admin.getPlugin('plugin/delete')) {
          this.pushFilter({
            label: $localize`Filters 🕵️️`,
            filters : [
              { filter: 'plugin/delete', label: $localize`🗑️ deleted` },
            ],
          });
        }
      }
      this.pushFilter({
        label: $localize`Origins 🏛️`,
        filters: this.store.origins.list.map(o => ({ filter: 'query/' + (o || '*') as UrlFilter,
          label:
            !o ? $localize`✴️ local`
              : o === this.store.account.origin ? $localize`🏛️ ${o}`
                : !this.store.account.origin ? $localize`🏛️ ${o}`
                  : $localize`🪆 ${o}` })),
      });
      this.sync();
    }
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
        if (f.startsWith('user/')) setToggles.push(f);
        if (f.startsWith('!') || hasPrefix(f, 'plugin')) setToggles.push(f);
        if (f.startsWith('scheme/')) this.loadFilter({ group: $localize`Schemes 🏳️️`, scheme: f.substring('scheme/'.length)});
        if (f.startsWith('sources/')) this.loadFilter({ group: $localize`Filters 🕵️️`, label: $localize`Sources ⤴️`, sources: f.substring('sources/'.length) });
        if (f.startsWith('responses/')) this.loadFilter({ group: $localize`Filters 🕵️️`, label: $localize`Responses ⤵️`, responses: f.substring('responses/'.length) });
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
            if (f.startsWith('!') || f.startsWith('user/!') || f.startsWith('query/!(')) {
              target.label = this.store.account.querySymbol('!') + target.label;
            } else {
              target.label = target.label.substring(this.store.account.querySymbol('!').length);
            }
          }
        });
      } else if (f.startsWith('!') || hasPrefix(f, 'plugin')) {
        this.loadFilter({ group: $localize`Plugins 🧰️`, response: f as any });
      } else if (f.startsWith('user/')) {
        this.loadFilter({ group: $localize`Filters 🕵️️`, user: f.substring('user/'.length) as any });
      } else if (f.startsWith('query/@')) {
        const origin = f.substring('query/'.length);
        this.loadFilter({ group: $localize`Queries 🔎️️`, label: $localize`🏛️ ${origin}`, query: origin });
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
      group.filters.push(convertFilter(filter));
    } else {
      this.allFilters.push({
        label: filter.group || '',
        filters: [convertFilter(filter)],
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

  addFilter(value: UrlFilter) {
    if (value) {
      if (!this.filters) this.filters = [];
      this.filters.push(value);
      this.create!.nativeElement.selectedIndex = 0;
      this.setFilters();
    }
  }

  setFilter(index: number, value: UrlFilter) {
    this.filters[index] = value;
    this.setFilters();
  }

  title(value: UrlFilter) {
    for (const g of this.allFilters) {
      for (const f of g.filters) {
        if (f.filter === value) return f.title || '';
      }
    }
    return '';
  }

  negatable(filter: string) {
    return negatable(filter);
  }

  toggleQuery(index: number) {
    this.filters[index] = toggle(this.filters[index])!;
    this.setFilters();
  }

  lastFocused = false;
  hasFocus() {
    return this.lastFocused;
  }
  focus() {
    this.lastFocused = true;
    return true;
  }
  clearFocus() {
    this.lastFocused = false;
    return true;
  }

  set(index: number, filter: UrlFilter, isoDate: string) {
    this.clearFocus();
    if (!isoDate) return;
    // @ts-ignore
    this.filters[index] = filter.substring(0, filter.lastIndexOf('/') + 1) + isoDate;
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
    return DateTime.fromISO(date).toISO()!;
  }

  toDate(filter: string) {
    if (filter.includes('/')) filter = filter.substring(filter.lastIndexOf('/') + 1);
    return DateTime.fromISO(filter).toFormat("yyyy-MM-dd'T'T");
  }

}
