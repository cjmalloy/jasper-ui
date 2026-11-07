import { Component, computed, ElementRef, inject, input, linkedSignal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { filter, isEqual, uniq } from 'lodash-es';
import { DateTime } from 'luxon';
import { combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { Ext } from '../../model/ext';
import { FilterConfig } from '../../model/tag';
import { KanbanConfig } from '../../mods/org/kanban';
import { RootConfig } from '../../mods/root';
import { UserConfig } from '../../mods/user';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';
import { BookmarkService } from '../../service/bookmark.service';
import { EditorService } from '../../service/editor.service';
import { Store } from '../../store/store';
import { Type } from '../../store/view';
import { emoji } from '../../util/emoji';
import {
  convertFilter,
  convertSort,
  filterColumnTag,
  FilterGroup,
  FilterItem,
  filterLabel,
  filterTags,
  negatable,
  parseValueFilter,
  switchFilter,
  toggle,
  UrlFilter,
  validColumnFilter,
  validFilterColumn,
  valueFilterConfig
} from '../../util/query';
import { hasPrefix } from '../../util/tag';
import { RelativeDateComponent } from '../relative-date/relative-date.component';
import { ValueFilterComponent } from '../value-filter/value-filter.component';

@Component({
  selector: 'app-filter',
  templateUrl: './filter.component.html',
  styleUrls: ['./filter.component.scss'],
  host: { 'class': 'filter form-group' },
  imports: [ReactiveFormsModule, FormsModule, ValueFilterComponent, RelativeDateComponent]
})
export class FilterComponent {
  router = inject(Router);
  admin = inject(AdminService);
  store = inject(Store);
  private auth = inject(AuthzService);
  private bookmarks = inject(BookmarkService);
  private editor = inject(EditorService);
  private account = inject(AccountService);


  readonly create = viewChild<ElementRef<HTMLSelectElement>>('create');

  readonly activeExts = input<Ext[]>([]);
  readonly type = input<Type>();

  modifiedBeforeFilter: FilterItem = { filter: `modified/before/${DateTime.now().toISO()}`, label: $localize`🕓️ modified before` };
  modifiedAfterFilter: FilterItem = { filter: `modified/after/${DateTime.now().toISO()}`, label: $localize`🕓️ modified after` };
  responseBeforeFilter: FilterItem = { filter: `response/before/${DateTime.now().toISO()}`, label: $localize`🧵️ response before` };
  responseAfterFilter: FilterItem = { filter: `response/after/${DateTime.now().toISO()}`, label: $localize`🧵️ response after` };
  publishedBeforeFilter: FilterItem = { filter: `published/before/${DateTime.now().toISO()}`, label: $localize`📅️ published before` };
  publishedAfterFilter: FilterItem = { filter: `published/after/${DateTime.now().toISO()}`, label: $localize`📅️ published after` };
  createdBeforeFilter: FilterItem = { filter: `created/before/${DateTime.now().toISO()}`, label: $localize`✨️ created before` };
  createdAfterFilter: FilterItem = { filter: `created/after/${DateTime.now().toISO()}`, label: $localize`✨️ created after` };

  readonly filters = linkedSignal(() => {
    const filters = this.store.view.filter();
    const values = Array.isArray(filters) ? [...filters] : [filters];
    return values.filter((value, index) => !values.slice(index + 1).includes(toggle(value)!));
  });
  private readonly kanbanPreviews = toSignal(toObservable(computed(() => this.kanbanExts())).pipe(
    switchMap(exts => exts.length ? combineLatest(exts.map(ext => {
      const config = ext.config as KanbanConfig;
      return this.editor.getTagsPreview(uniq([
        ...config.columns || [], ...config.swimLanes || [], ...config.badges || [],
      ]), ext.origin || '').pipe(map(previews => ({ key: ext.tag + (ext.origin || ''), previews })));
    })).pipe(startWith([])) : of([])),
  ), { initialValue: [] });
  private readonly tagNames = toSignal(toObservable(computed(() => uniq(this.filters().flatMap(filterTags)), { equal: isEqual })).pipe(
    switchMap(tags => this.editor.getTagNames(tags, this.store.account.origin()).pipe(startWith(new Map<string, string>()))),
  ), { initialValue: new Map<string, string>() });
  private readonly knownSorts = computed(() => (this.type() === 'ref' ? this.admin.refSorts() : this.admin.tagSorts()).map(convertSort));
  readonly allFilters = computed(() => this.buildFilters());

  /**
   * Query of the page without filters, to find the range of value filters in.
   */
  readonly rangeQuery = computed(() => this.store.view.current() === 'home'
    ? this.account.homeQuery() || ''
    : this.store.view.tag());

  emoji = emoji($localize`🪄️`) || $localize`🔍️`;

  private buildFilters() {
    let groups: FilterGroup[] = [];
    const push = (...fgs: FilterGroup[]) => {
      for (const fg of fgs) {
        const index = groups.findIndex(group => group.label === (fg.label || ''));
        if (index < 0) groups.push({ ...fg, filters: [...fg.filters] });
        else groups[index] = { ...groups[index], filters: [...groups[index].filters, ...fg.filters] };
      }
    };
    const load = (config: FilterConfig) => {
      const query = config.query || config.response || filterColumnTag(config);
      if (query && !this.auth.queryReadAccess(query)) return;
      push({ label: config.group || '', filters: [convertFilter(config)] });
    };
    if (this.type() === 'ref') {
      for (const ext of this.activeExts()) {
        for (const f of [...ext.config?.queryFilters || [], ...ext.config?.responseFilters || []]) {
          load({
            group: ext.name || this.admin.getPlugin(ext.tag)?.name || this.admin.getTemplate(ext.tag)?.name || '#' + ext.tag,
            ...f,
          });
        }
      }
      push({
        label: $localize`Queries 🔎️️`, filters: [],
      });
      if (this.auth.hasRole('ROLE_USER')) {
        push({
          label: $localize`Lists ☰`, filters: [],
        });
      }
      push({
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
      for (const e of this.kanbanExts()) {
        const group = $localize`Kanban 📋️`;
        const k = e.config! as KanbanConfig;
        if (k.columns?.length) {
          push({ label: group, filters: [] });
          const ps = this.kanbanPreviews().find(result => result.key === e.tag + (e.origin || ''))?.previews || [];
          for (const p of ps) {
            load({ group, label: p.name || '#' + p.tag, query: p.tag });
          }
          if (k.showColumnBacklog) {
            load({
              group, label: k.columnBacklogTitle || $localize`🚫️ no column`,
              query: k.columns.map(t => '!' + t).join(':'),
            });
          }
          if (k.swimLanes?.length && k.showSwimLaneBacklog) {
            load({
              group, label: k.swimLaneBacklogTitle || $localize`🚫️ no swim lane`,
              query: k.swimLanes.map(t => '!' + t).join(':'),
            });
          }
          if (k.badges?.length) {
            load({
              group, label: $localize`🚫️ no badges`,
              query: k.badges.map(t => '!' + t).join(':'),
            });
          }
        }
      }
      push({
        label: $localize`Plugins 🧰️`, filters: [],
      }, {
        label: $localize`Schemes 🏳️️`, filters: [],
      }, {
        label: $localize`Templates 🎨️`, filters: [],
      });
      for (const f of this.admin.filters()) load(f);
      push({
        label: $localize`Filters 🕵️️`,
        filters: [
          { filter: 'obsolete', label: $localize`⏮️ obsolete`, title: $localize`Show older versions` },
          { filter: 'query/_plugin:!+user', label: $localize`📟️ system`, title: $localize`System configs` },
        ],
      });
    } else {
      push({
        label: $localize`Time ⏱️`,
        filters : [
          this.modifiedBeforeFilter,
          this.modifiedAfterFilter,
        ],
      });
      if (this.admin.getPlugin('plugin/delete')) {
        push({
          label: $localize`Filters 🕵️️`,
          filters : [
            { filter: 'plugin/delete', label: $localize`🗑️ deleted` },
          ],
        });
      }
    }
    push({
      label: $localize`Origins 🏛️`,
      filters: this.store.origins.list().map(o => ({ filter: 'query/' + (o || '*') as UrlFilter,
        label:
          !o ? $localize`✴️ local`
            : o === this.store.account.origin() ? $localize`🏛️ ${o}`
              : !this.store.account.origin() ? $localize`🏛️ ${o}`
                : $localize`🪆 ${o}` })),
    });
    const dates = ['modified', 'response', 'published', 'created'];
    for (const value of this.filters()) {
      const datePrefix = dates.flatMap(date => [`${date}/before/`, `${date}/after/`]).find(prefix => value.startsWith(prefix));
      const v = parseValueFilter(value);
      // Show the value in an unused option for the same bound, so repeated bounds each keep an option
      const sameValueFilter = (item: FilterItem) => {
        const i = parseValueFilter(item.filter);
        return i?.column === v?.column && i?.dir === v?.dir && !this.filters().includes(item.filter);
      };
      if (datePrefix) {
        groups = groups.map(group => ({ ...group, filters: group.filters.map(item =>
          item.filter.startsWith(datePrefix) ? { ...item, filter: value } : item) }));
      } else if (v && !groups.some(group => group.filters.some(item => item.filter === value)) && groups.some(group => group.filters.some(sameValueFilter))) {
        let replaced = false;
        groups = groups.map(group => ({ ...group, filters: group.filters.map(item => {
          if (replaced || !sameValueFilter(item)) return item;
          replaced = true;
          return { ...item, filter: value };
        }) }));
      } else if (!groups.some(group => group.filters.some(item => item.filter === value))) {
        const opposite = toggle(value);
        const match = groups.some(group => group.filters.some(item => item.filter === opposite));
        if (match) {
          const not = this.store.account.querySymbol('!');
          groups = groups.map(group => ({ ...group, filters: group.filters.map(item => item.filter === opposite
            ? { ...item, filter: value, label: item.label.startsWith(not) ? item.label.substring(not.length) : not + item.label }
            : item) }));
        } else if (v) {
          if (validFilterColumn(this.type() || 'ref', v.column)) {
            load({ ...valueFilterConfig(v, $localize`Filters 🕵️️`), label: this.filterLabel(value) });
          }
        } else if (value.startsWith('scheme/')) {
          load({ group: $localize`Schemes 🏳️️`, scheme: value.substring('scheme/'.length) });
        } else if (value.startsWith('sources/')) {
          load({ group: $localize`Filters 🕵️️`, label: $localize`Sources ⤴️`, sources: value.substring('sources/'.length) });
        } else if (value.startsWith('responses/')) {
          load({ group: $localize`Filters 🕵️️`, label: $localize`Responses ⤵️`, responses: value.substring('responses/'.length) });
        } else if (value.startsWith('!') || hasPrefix(value, 'plugin')) {
          load({ group: $localize`Plugins 🧰️`, response: value as any, label: this.filterLabel(value) });
        } else if (value.startsWith('user/')) {
          load({ group: $localize`Filters 🕵️️`, user: value.substring('user/'.length) as any, label: this.filterLabel(value) });
        } else if (value.startsWith('query/')) {
          const query = value.substring('query/'.length);
          load({ group: $localize`Queries 🔎️️`, query, label: query.startsWith('@') ? $localize`🏛️ ${query}` : this.filterLabel(value) });
        } else if (validColumnFilter(this.type() || 'ref', value) && this.filterLabel(value)) {
          push({ label: $localize`Filters 🕵️️`, filters: [{ filter: value, label: this.filterLabel(value)! }] });
        }
      }
    }
    return groups;
  }


  private filterLabel(filter: UrlFilter) {
    const names = this.tagNames();
    return filterLabel(filter, tag => names.get(tag) || this.admin.getPlugin(tag)?.name || this.admin.getTemplate(tag)?.name, this.knownSorts());
  }

  readonly rootConfigs = computed(() => {
    if (!this.admin.getTemplate('')) return [];
    return this.activeExts().map(x => x.config).filter(c => !!c) as RootConfig[];
  });

  readonly userConfigs = computed(() => {
    if (!this.admin.getTemplate('user')) return [];
    return this.activeExts()
      .filter(x => hasPrefix(x.tag, 'user'))
      .map(x => x.config).filter(c => !!c) as UserConfig[];
  });

  readonly kanbanExts = computed(() => {
    if (!this.admin.getTemplate('kanban')) return [];
    return this.activeExts()
      .filter(x => hasPrefix(x.tag, 'kanban'))
      .filter(x => x.config);
  });

  addFilter(value: UrlFilter) {
    if (value) {
      this.filters.update(filters => [...filters || [], value]);
      this.create()!.nativeElement.selectedIndex = 0;
      this.setFilters();
    }
  }

  setFilter(index: number, value: UrlFilter) {
    this.filters.update(filters => filters.map((f, i) => i === index ? value : f));
    this.setFilters();
  }

  title(value: UrlFilter) {
    for (const g of this.allFilters()) {
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
    this.filters.update(filters => filters.map((f, i) => i === index ? toggle(f)! : f));
    this.setFilters();
  }

  set(index: number, filter: UrlFilter, isoDate: string) {
    if (!isoDate) return;
    const value = filter.substring(0, filter.lastIndexOf('/') + 1) + isoDate as UrlFilter;
    this.filters.update(filters => filters.map((f, i) => i === index ? value : f));
    this.setFilters();
  }

  readonly parseValueFilter = parseValueFilter;
  readonly switchFilter = switchFilter;

  setValue(index: number, filter: UrlFilter, value: string) {
    const v = parseValueFilter(filter);
    if (v) this.setFilter(index, `${v.column}/${v.dir}/${value}` as UrlFilter);
  }

  removeFilter(index: number) {
    this.filters.update(filters => filters.filter((f, i) => i !== index));
    this.setFilters();
  }

  setFilters() {
    this.bookmarks.setFilters(filter(this.filters(), f => !!f));
  }

  dateValue(filter: string) {
    return filter.substring(filter.lastIndexOf('/') + 1);
  }

}
