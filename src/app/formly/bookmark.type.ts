import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  TemplateRef,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FieldType, FieldTypeConfig, FormlyAttributes, FormlyConfig } from '@ngx-formly/core';
import { debounce, defer, find, uniq, uniqBy } from 'lodash-es';
import { forkJoin, map, Observable, of, Subscription, switchMap } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Crumb } from '../component/query/query.component';
import { Ext } from '../model/ext';
import { Config, FilterConfig } from '../model/tag';
import { type Template } from '../model/template';
import { KanbanConfig } from '../mods/org/kanban';
import { AdminService } from '../service/admin.service';
import { ExtService } from '../service/api/ext.service';
import { EditorService } from '../service/editor.service';
import { Store } from '../store/store';
import { convertFilter, convertSort, defaultDesc, FilterGroup, FilterItem, negatable, SortItem, toggle, UrlFilter } from '../util/query';
import { access, fixClientQuery, getStrictPrefix, hasPrefix, isQuery, localTag, queryPrefix, tagOrigin, topAnds } from '../util/tag';
import { encodeBookmarkParams, parseBookmarkParams } from '../util/http';
import { getErrorMessage } from './errors';

@Component({
  selector: 'formly-field-bookmark-input',
  host: { 'class': 'field bookmark-field' },
  styles: `
    .form-array {
      position: relative;
    }
    .preview {
      pointer-events: none;
    }
    .breadcrumbs {
      position: absolute;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      overflow: hidden;
      padding-block: 2px;
      padding-inline: 8px;
      display: flex;
      align-items: center;
      * {
        color: var(--text);
        text-decoration: none;
        cursor: text;
      }
      .crumbs-left {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .op {
        font-family: KaTeX_Main, "Times New Roman", serif;
      }
      .filter-preview {
        flex-shrink: 0;
        color: var(--active);
        font-size: 0.85em;
        margin-inline-start: 4px;
        cursor: pointer !important;
      }
      .wand, .filter-toggle {
        flex-shrink: 0;
        margin-inline-start: 4px;
        opacity: 0.35;
        cursor: pointer !important;
        &:hover {
          opacity: 1;
        }
      }
    }
    .params-panel {
      background: var(--card);
      border: 1px dashed var(--border);
      border-radius: 8px;
      box-shadow: 0 5px 5px -3px rgba(0, 0, 0, 0.2),
                  0 8px 10px 1px rgba(0, 0, 0, 0.1),
                  0 3px 14px 2px rgba(0, 0, 0, 0.3);
      padding: 8px;
      min-width: 260px;
      max-width: 400px;
      z-index: 1000;
      input[type=search] {
        display: block;
        width: 100%;
        box-sizing: border-box;
      }
      select {
        display: block;
        width: 100%;
      }
      .unselected {
        text-align: center;
      }
    }
  `,
  template: `
    <div class="form-array skip-margin">
      <input class="preview grow"
             type="text"
             [style.display]="preview ? 'block' : 'none'">
      <div #div
           class="breadcrumbs"
           [title]="queryPart"
           [style.display]="preview ? 'flex' : 'none'"
           (click)="$event.target === div && edit(input, false)">
        <span class="crumbs-left" (click)="edit(input, false)">
          @for (breadcrumb of breadcrumbs; track breadcrumb) {
            <span class="crumb">
              @if (breadcrumb.tag) {
                <a class="tag" [routerLink]="['/tag', breadcrumb.tag]" queryParamsHandling="merge"><span (click)="clickPreview(input, $event, breadcrumb)">{{ breadcrumb.text }}</span></a>
              } @else {
                <span class="op" (click)="edit(input, breadcrumb)">{{ breadcrumb.text }}</span>
              }
            </span>
          }
        </span>
        <span #paramAnchor
              [class]="hasParams ? 'filter-preview' : 'filter-toggle'"
              (click)="toggleParams(); $event.stopPropagation()">{{ hasParams ? paramSummary : '🪄️' }}</span>
      </div>
      <datalist [id]="listId">
        @for (o of autocomplete; track o.value) {
          <option [value]="o.value">{{ o.label }}</option>
        }
      </datalist>
      <input #input
             class="grow"
             type="text"
             enterkeyhint="enter"
             autocorrect="off"
             autocapitalize="none"
             [attr.list]="listId"
             [class.hidden-without-removing]="preview"
             [value]="formControl.value || ''"
             (input)="onQueryInput(input.value)"
             (blur)="blur(input)"
             (focusin)="edit(input, false)"
             (focus)="edit(input, false)"
             (focusout)="getPreview(queryPart)"
             [formlyAttributes]="field"
             [class.is-invalid]="showError">
    </div>
    <ng-template #paramsPanel>
      <div class="params-panel form-group" (click)="$event.stopPropagation()">
        <input type="search"
               [ngModel]="searchText"
               (ngModelChange)="setSearch($event)"
               i18n-placeholder
               placeholder="Search text…">
        <select class="big"
                (input)="addSort($any($event.target).value); $any($event.target).selectedIndex = 0"
                i18n-title title="Sort">
          <option class="unselected" i18n>🔼️ sort</option>
          @for (s of allSorts; track s.value) {
            <option [value]="s.value" [title]="s.title || ''">{{ s.label }}</option>
          }
        </select>
        @for (sort of sorts; track sort; let i = $index) {
          <span class="controls">
            <select [ngModel]="sortCol(sort)" (ngModelChange)="setSortCol(i, $event)">
              @for (s of allSorts; track s.value) {
                <option [value]="s.value">{{ s.label }}</option>
              }
            </select>
            @if (sortDir(sort) === 'DESC') {
              <button type="button" (click)="setSortDir(i, 'ASC')" i18n-title title="Descending" i18n>🔽️</button>
            } @else {
              <button type="button" (click)="setSortDir(i, 'DESC')" i18n-title title="Ascending" i18n>🔼️</button>
            }
            <button type="button" (click)="removeSort(i)" i18n>&ndash;</button>
          </span>
        }
        <select class="big"
                (input)="addFilter($any($event.target).value); $any($event.target).selectedIndex = 0"
                i18n-title title="Filter">
          <option class="unselected" i18n>🪄️ filter</option>
          @for (g of allFilters; track g.label) {
            @if (g.filters.length) {
              <optgroup [label]="g.label">
                @for (f of g.filters; track f.filter) {
                  <option [value]="f.filter" [title]="f.title || ''">{{ f.label || f.filter }}</option>
                }
              </optgroup>
            }
          }
        </select>
        @for (filter of filters; track filter; let i = $index) {
          <div class="controls" [title]="filter">
            <select [ngModel]="filter" (ngModelChange)="setFilter(i, $event)">
              @for (g of allFilters; track g.label) {
                @if (g.filters.length) {
                  <optgroup [label]="g.label">
                    @for (f of g.filters; track f.filter) {
                      <option [value]="f.filter" [title]="f.title || ''">{{ f.label || f.filter }}</option>
                    }
                  </optgroup>
                }
              }
            </select>
            @if (negatable(filter)) {
              <button type="button" (click)="toggleFilter(i)">{{ store.account.querySymbol('!') }}</button>
            }
            <button type="button" (click)="removeFilter(i)" i18n>&ndash;</button>
          </div>
        }
      </div>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    FormsModule,
    FormlyAttributes,
  ],
})
export class FormlyFieldBookmarkInput extends FieldType<FieldTypeConfig> implements AfterViewInit, OnDestroy {

  @ViewChild('paramAnchor')
  paramAnchor!: ElementRef<HTMLSpanElement>;

  @ViewChild('paramsPanel')
  paramsPanel!: TemplateRef<any>;

  listId = 'list-' + uuid();
  breadcrumbs: Crumb[] = [];
  editing = false;
  autocomplete: { value: string, label: string }[] = [];

  sorts: string[] = [];
  filters: string[] = [];
  searchText = '';
  allFilters: FilterGroup[] = [];

  private overlayRef?: OverlayRef;
  private overlayEvents?: Subscription;
  private showedError = false;
  private searching?: Subscription;
  private formChanges?: Subscription;
  private filterOptions?: Subscription;
  private _query = '';

  constructor(
    private router: Router,
    private config: FormlyConfig,
    private admin: AdminService,
    private editor: EditorService,
    private exts: ExtService,
    public store: Store,
    private cd: ChangeDetectorRef,
    private overlay: Overlay,
    private vcr: ViewContainerRef,
  ) {
    super();
  }

  ngAfterViewInit() {
    const v = this.model?.[this.key as any];
    if (v) {
      this.syncParams(v);
      this.getPreview(this.extractQuery(v));
    } else {
      this.buildAllFilters();
    }
    this.formChanges?.unsubscribe();
    this.formChanges = this.formControl.valueChanges.subscribe(value => {
      if (!this.editing) {
        if (value) {
          const q = this.extractQuery(value);
          this.syncParams(value);
          this.getPreview(q);
        } else {
          this.query = '';
          this.sorts = [];
          this.filters = [];
          this.searchText = '';
          this.buildAllFilters();
        }
      }
    });
  }

  ngOnDestroy() {
    this.searching?.unsubscribe();
    this.formChanges?.unsubscribe();
    this.filterOptions?.unsubscribe();
    this.closeParams();
  }

  get preview() {
    return !this.editing && this.query;
  }

  get query(): string {
    return this._query;
  }

  set query(value: string) {
    this.editing = false;
    this.cd.detectChanges();
    if (this._query === value) return;
    this._query = value;
    this.breadcrumbs = this.queryCrumbs(this._query);
    this.cd.detectChanges();
  }

  get queryPart(): string {
    return this.extractQuery(this.formControl.value || '');
  }

  get paramsString(): string {
    const v = this.formControl.value || '';
    const idx = v.indexOf('?');
    return idx === -1 ? '' : v.substring(idx + 1);
  }

  get hasParams(): boolean {
    return this.sorts.filter(s => !!s && !s.startsWith(',')).length > 0
      || this.filters.filter(f => !!f).length > 0
      || !!this.searchText;
  }

  get paramSummary(): string {
    const parts: string[] = [];
    if (this.sorts.length) {
      const col = this.sortCol(this.sorts[0]);
      const dir = this.sortDir(this.sorts[0]);
      const dirEmoji = dir === 'DESC' ? '🔽️' : '🔼️';
      const label = this.allSorts.find(s => s.value === col)?.label || col;
      parts.push(dirEmoji + ' ' + label);
      if (this.sorts.length > 1) parts.push(`+${this.sorts.length - 1}`);
    }
    if (this.searchText) {
      parts.push('🔍️ ' + this.searchText);
    }
    if (this.filters.filter(f => !!f).length) {
      parts.push('🪄️' + this.filters.filter(f => !!f).length);
    }
    return parts.join(' ');
  }

  get allSorts(): SortItem[] {
    const base: SortItem[] = [
      { value: 'published', label: $localize`📅️ published` },
      { value: 'created', label: $localize`✨️ created` },
      { value: 'modified', label: $localize`🕓️ modified` },
      { value: 'rank', label: $localize`🔍️ relevance` },
      { value: 'title', label: $localize`🔤️ title` },
      { value: 'url', label: $localize`🔗️ url` },
      { value: 'origin:len', label: $localize`🪆 nesting` },
    ];
    return [...base, ...this.admin.refSorts.map(convertSort)];
  }

  private extractQuery(value: string): string {
    if (!value) return '';
    const idx = value.indexOf('?');
    return idx === -1 ? value : value.substring(0, idx);
  }

  private buildAllFilters(): void {
    const query = this.queryPart;
    this.filterOptions?.unsubscribe();
    this.buildFilterGroups();
    this.filterOptions = this.getQueryActiveExts(query).pipe(
      switchMap(exts => {
        if (query !== this.queryPart) return of(undefined);
        return this.buildFilterGroups(exts, query);
      }),
    ).subscribe(() => {
      if (query !== this.queryPart) return;
      this.syncFilterOptions();
      this.cd.detectChanges();
    });
    this.syncFilterOptions(false);
  }

  private buildFilterGroups(activeExts: Ext[] = [], query = this.queryPart): Observable<undefined> {
    this.allFilters = [];
    this.loadActiveExtFilters(activeExts);
    this.pushFilter({
      label: $localize`Queries 🔎️️`, filters: [],
    }, {
      label: $localize`Lists ☰`, filters: [],
    }, {
      label: $localize`Media 🎬️`, filters: [],
    }, {
      label: $localize`Games 🕹️`, filters: [],
    }, {
      label: $localize`Time ⏱️`, filters: [],
    }, {
      label: $localize`Filters 🕵️️`, filters: [],
    }, {
      label: $localize`Delta Δ`, filters: [],
    }, {
      label: $localize`Mod Tools 🛡️`, filters: [],
    });
    const kanbanFilterLoader = this.loadActiveKanbanFilters(activeExts, query);
    this.pushFilter({
      label: $localize`Plugins 🧰️`, filters: [],
    }, {
      label: $localize`Schemes 🏳️️`, filters: [],
    }, {
      label: $localize`Templates 🎨️`, filters: [],
    });
    for (const f of this.admin.filters) this.loadFilter(f);
    const coreFilters: FilterItem[] = [
      { filter: 'obsolete' as UrlFilter, label: $localize`⏮️ obsolete`, title: $localize`Show older versions` },
    ];
    if (this.admin.getPlugin('plugin/delete')) {
      coreFilters.push({ filter: 'plugin/delete' as UrlFilter, label: $localize`🗑️ deleted` });
    }
    this.pushFilter({ label: $localize`Filters 🕵️️`, filters: coreFilters });
    const originFilters = this.store.origins.list.map(o => ({
      filter: ('query/' + (o || '*')) as UrlFilter,
      label: !o ? $localize`✴️ local` : $localize`🏛️ ${o}`,
    }));
    this.pushFilter({ label: $localize`Origins 🏛️`, filters: originFilters });
    return kanbanFilterLoader;
  }

  private getQueryActiveExts(query: string): Observable<Ext[]> {
    const topLevelPrefixes = topAnds(query).map(queryPrefix);
    const queryPrefixes = uniq(topLevelPrefixes
      .filter(t => t && !isQuery(t)));
    const templates = uniq(queryPrefixes
      .map(tag => this.admin.view.find(t => hasPrefix(tag, t.tag)))
      .filter((t): t is Template => !!t));
    if (!templates.length) return of([]);
    return this.exts.getCachedExts(queryPrefixes).pipe(
      this.admin.extFallbacks,
      map(exts => uniq(templates.flatMap(t => {
        const persistedExts = exts.filter(x => x.modifiedString && hasPrefix(x.tag, t.tag));
        if (persistedExts.length) return persistedExts;
        return [{
          tag: t.tag,
          origin: t.origin,
          name: t.name,
          config: {
            ...t.defaults,
            ...(t.config?.tab !== undefined ? { tab: t.config.tab } : {}),
            ...(t.config?.view !== undefined ? { view: t.config.view } : {}),
          },
        } as Ext];
      }).filter(x => !!x))),
    );
  }

  private loadActiveExtFilters(activeExts: Ext[]): void {
    for (const ext of activeExts) {
      for (const f of [...ext.config?.queryFilters || [], ...ext.config?.responseFilters || []]) {
        this.loadFilter({
          group: ext.name || this.admin.getPlugin(ext.tag)?.name || this.admin.getTemplate(ext.tag)?.name || '#' + ext.tag,
          ...f,
        });
      }
    }
  }

  private loadActiveKanbanFilters(activeExts: Ext[], query: string): Observable<undefined> {
    const kanbanFilterLoaders: Observable<unknown>[] = [];
    // Add kanban column/badge/swimlane filters from bookmark query active exts.
    if (this.admin.getTemplate('kanban')) {
      for (const e of activeExts.filter(x => hasPrefix(x.tag, 'kanban') && x.config)) {
        const group = $localize`Kanban 📋️`;
        const k = e.config as KanbanConfig;
        if (k.columns?.length) {
          if (!find(this.allFilters, f => f.label === group)) {
            this.allFilters.push({ label: group, filters: [] });
          }
          const kanbanTags = uniq([...k.columns, ...k.swimLanes || [], ...k.badges || []]);
          kanbanFilterLoaders.push(this.editor.getTagsPreview(kanbanTags, e.origin || '').pipe(map(ps => {
            if (query !== this.queryPart) return;
            for (const p of ps) {
              this.loadFilter({ group, label: p.name || '#' + p.tag, query: p.tag });
            }
            if (k.columns?.length && k.showColumnBacklog) {
              this.loadFilter({ group, label: k.columnBacklogTitle || $localize`🚫️ no column`, query: (k.columns || []).map(t => '!' + t).join(':') });
            }
            if (k.swimLanes?.length && k.showSwimLaneBacklog) {
              this.loadFilter({ group, label: k.swimLaneBacklogTitle || $localize`🚫️ no swim lane`, query: k.swimLanes!.map(t => '!' + t).join(':') });
            }
            if (k.badges?.length) {
              this.loadFilter({ group, label: $localize`🚫️ no badges`, query: k.badges.map(t => '!' + t).join(':') });
            }
          })));
        }
      }
    }
    return kanbanFilterLoaders.length ? forkJoin(kanbanFilterLoaders).pipe(map(() => undefined)) : of(undefined);
  }

  private loadFilter(filter: FilterConfig) {
    let group = find(this.allFilters, f => f.label === (filter.group || ''));
    if (group) {
      group.filters.push(convertFilter(filter));
    } else {
      this.allFilters.push({ label: filter.group || '', filters: [convertFilter(filter)] });
    }
  }

  private pushFilter(...fgs: FilterGroup[]) {
    for (const fg of fgs) {
      const group = find(this.allFilters, f => f.label === (fg.label || ''));
      if (group) {
        group.filters.push(...fg.filters);
      } else {
        this.allFilters.push(fg);
      }
    }
  }

  /** Mirror filter.component.ts sync(): mutate allFilters options to show ! prefix for negated filters,
   *  and add missing filters so they appear in the dropdown. */
  private syncFilterOptions(addMissing = true): void {
    for (const f of this.filters) {
      const toggled = toggle(f as UrlFilter);
      if (!toggled) continue;
      const sets = this.allFilters.filter(g => g.filters.find(i => i.filter === toggled));
      if (sets.length) {
        sets.forEach(g => {
          const target = g.filters.find(i => i.filter === toggled);
          if (target) {
            target.filter = f as UrlFilter;
            const sym = this.store.account.querySymbol('!');
            if (f.startsWith('!') || f.startsWith('user/!') || f.startsWith('query/!(')) {
              if (!(target.label || '').startsWith(sym)) {
                target.label = sym + (target.label || '');
              }
            } else {
              if ((target.label || '').startsWith(sym)) {
                target.label = (target.label || '').substring(sym.length);
              }
            }
          }
        });
      } else if (addMissing && !this.allFilters.find(g => g.filters.find(i => i.filter === f))) {
        // Filter not found — add it as a fallback so the dropdown shows the current value
        if (f.startsWith('!') || hasPrefix(f, 'plugin')) {
          this.loadFilter({ group: $localize`Plugins 🧰️`, response: f as any });
        } else if (f.startsWith('user/')) {
          this.loadFilter({ group: $localize`Filters 🕵️️`, user: f.substring('user/'.length) as any });
        } else if (f.startsWith('scheme/')) {
          this.loadFilter({ group: $localize`Filters 🕵️️`, scheme: f.substring('scheme/'.length) });
        } else if (f.startsWith('sources/')) {
          this.loadFilter({ group: $localize`Filters 🕵️️`, label: $localize`Sources ⤴️`, sources: f.substring('sources/'.length) });
        } else if (f.startsWith('responses/')) {
          this.loadFilter({ group: $localize`Filters 🕵️️`, label: $localize`Responses ⤵️`, responses: f.substring('responses/'.length) });
        } else if (f.startsWith('query/')) {
          this.loadFilter({ group: $localize`Queries 🔎️️`, query: f.substring('query/'.length) });
        }
      }
    }
  }

  private syncParams(value: string) {
    const idx = value.indexOf('?');
    if (idx === -1) {
      this.sorts = [];
      this.filters = [];
      this.searchText = '';
      this.buildAllFilters();
      return;
    }
    const params = parseBookmarkParams(value.substring(idx + 1));
    this.sorts = [params['sort']].flat().filter(Boolean);
    this.filters = [params['filter']].flat().filter(Boolean);
    this.searchText = params['search'] || '';
    this.buildAllFilters();
  }

  private buildParamsString(): string {
    const p: Record<string, string | string[]> = {};
    const sorts = this.sorts.filter(s => !!s && !s.startsWith(','));
    const filters = this.filters.filter(f => !!f);
    if (sorts.length) p['sort'] = sorts;
    if (filters.length) p['filter'] = filters;
    if (this.searchText) p['search'] = this.searchText;
    return encodeBookmarkParams(p);
  }

  private updateFormValue() {
    const query = this.queryPart;
    const paramsStr = this.buildParamsString();
    this.formControl.setValue(paramsStr ? `${query}?${paramsStr}` : query);
    this.formControl.markAsDirty();
    this.cd.detectChanges();
  }

  onQueryInput(value: string) {
    this.editing = true;
    // If user typed a ? directly, sync params from it and store as-is
    if (value.includes('?')) {
      this.syncParams(value);
      this.formControl.setValue(value);
    } else {
      const paramsStr = this.paramsString;
      this.formControl.setValue(paramsStr ? `${value}?${paramsStr}` : value);
    }
    this.formControl.markAsDirty();
    this.search(value.split('?')[0]);
  }

  validate(input: HTMLInputElement) {
    if (this.showError) {
      input.setCustomValidity(getErrorMessage(this.field, this.config));
      input.reportValidity();
    }
  }

  blur(input: HTMLInputElement) {
    this.formControl.markAsTouched();
    if (this.showError && !this.showedError) {
      this.showedError = true;
      defer(() => this.validate(input));
    } else {
      this.showedError = false;
      this.getPreview(this.queryPart);
    }
  }

  getPreview(value: string) {
    if (!value) return;
    if (this.showError) return;
    this.query = value;
  }

  preview$(value: string): Observable<{ name?: string, tag: string } | undefined> {
    return this.editor.getTagPreview(
      value,
      this.field.props.origin || this.store.account.origin,
      false,
      this.field.type !== 'plugin',
      this.field.type !== 'template');
  }

  clickPreview(input: HTMLInputElement, event: MouseEvent, breadcrumb: Crumb): boolean {
    if (this.store.hotkey) {
      this.router.navigate(['/tag', breadcrumb.tag]);
    } else {
      this.edit(input, breadcrumb);
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    return false;
  }

  edit(input: HTMLInputElement, select: boolean | Crumb) {
    this.editing = true;
    this.cd.detectChanges();
    input.focus();
    if (select === true) {
      input.select();
    } else if (select) {
      input.setSelectionRange(select.pos, select.pos + select.len);
    }
  }

  // Sort management
  sortCol(sort: string): string {
    if (!sort.includes(',')) return sort;
    return sort.split(',')[0];
  }

  sortDir(sort: string): string {
    if (!sort.includes(',')) return defaultDesc(sort) ? 'DESC' : 'ASC';
    return sort.split(',')[1].toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  }

  addSort(value: string) {
    if (!value) return;
    const dir = defaultDesc(value) ? 'DESC' : 'ASC';
    this.sorts.push(value + ',' + dir);
    this.updateFormValue();
  }

  setSortCol(index: number, col: string) {
    const dir = this.sortDir(this.sorts[index]);
    this.sorts[index] = col + ',' + dir;
    this.updateFormValue();
  }

  setSortDir(index: number, dir: string) {
    const col = this.sortCol(this.sorts[index]);
    this.sorts[index] = col + ',' + dir;
    this.updateFormValue();
  }

  removeSort(index: number) {
    this.sorts.splice(index, 1);
    this.updateFormValue();
  }

  // Filter management
  addFilter(value: string) {
    if (!value) return;
    this.filters.push(value);
    this.buildAllFilters();
    this.updateFormValue();
  }

  setFilter(index: number, value: string) {
    this.filters[index] = value;
    this.buildAllFilters();
    this.updateFormValue();
  }

  removeFilter(index: number) {
    this.filters.splice(index, 1);
    this.buildAllFilters();
    this.updateFormValue();
  }

  toggleFilter(index: number) {
    this.filters[index] = toggle(this.filters[index] as UrlFilter)!;
    this.buildAllFilters();
    this.updateFormValue();
  }

  negatable(filter: string) {
    return negatable(filter);
  }

  // Search management
  setSearch(value: string) {
    this.searchText = value;
    this.updateFormValue();
  }

  // Overlay management
  toggleParams() {
    if (this.overlayRef?.hasAttached()) {
      this.closeParams();
    } else {
      this.openParams();
    }
  }

  openParams() {
    this.closeParams();
    defer(() => {
      const positionStrategy = this.overlay.position()
        .flexibleConnectedTo(this.paramAnchor)
        .withPositions([{
          originX: 'end',
          originY: 'bottom',
          overlayX: 'end',
          overlayY: 'top',
        }, {
          originX: 'end',
          originY: 'top',
          overlayX: 'end',
          overlayY: 'bottom',
        }]);
      this.overlayRef = this.overlay.create({
        positionStrategy,
        scrollStrategy: this.overlay.scrollStrategies.reposition(),
        hasBackdrop: false,
      });
      this.overlayRef.attach(new TemplatePortal(this.paramsPanel, this.vcr));
      this.overlayEvents = this.overlayRef.outsidePointerEvents().subscribe(() => {
        this.closeParams();
      });
      this.cd.detectChanges();
    });
  }

  closeParams() {
    this.overlayEvents?.unsubscribe();
    this.overlayEvents = undefined;
    this.overlayRef?.detach();
    this.overlayRef?.dispose();
    this.overlayRef = undefined;
  }

  search = debounce((text: string) => {
    text = text.replace(/\s+$/, '');
    const parts = text.split(/[:|()\s]+/).filter(t => !!t);
    const value = parts.pop() || '';
    const prefix = text.substring(0, text.length - value.length)
    const tag = value.replace(/[^_+a-z0-9./@]/, '').toLowerCase();
    const toEntry = (p: Config) => ({ value: p.tag, label: p.name || p.tag });
    const getPlugins = (text: string, size = 5) => this.admin.searchPlugins(text).slice(0, size).map(toEntry);
    const getTemplates = (text: string, size = 5) => this.admin.searchTemplates(text).slice(0, size).map(toEntry);
    this.searching?.unsubscribe();
    this.searching = this.exts.page({
      query: this.props.prefix || '',
      search: tag,
      sort: ['origin:len', 'tag:len'],
      size: 5,
    }).pipe(
      switchMap(page => page.page.totalElements ? forkJoin(page.content.map(x => this.preview$(x.tag + x.origin))) : of([])),
      map(xs => xs.filter(x => !!x) as { name?: string, tag: string }[]),
    ).subscribe(xs => {
      this.autocomplete = xs.map(x => ({ value: prefix + x.tag, label: x.name || x.tag }));
      if (this.autocomplete.length < 5) this.autocomplete.push(...getPlugins(tag, 5 - this.autocomplete.length));
      if (this.autocomplete.length < 5) this.autocomplete.push(...getTemplates(tag, 5 - this.autocomplete.length));
      this.autocomplete = uniqBy(this.autocomplete, 'value')
      this.cd.detectChanges();
    });
  }, 400);

  private queryCrumbs(query: string): Crumb[] {
    if (!query) return [];
    let read = 0;
    const result: Crumb[] = fixClientQuery(query).split(/([:|()])/g).filter(t => !!t).map(part => {
      const pos = read;
      const len = part.length;
      read += len;
      if (/[:|()]+/.test(part)) return { text: part, pos, len };
      return { text: '', tag: part, pos, len };
    });
    for (let i = 0; i < result.length - 2; i++) {
      const a = result[i];
      const op = result[i + 1];
      const b = result[i + 2];
      if (!a.tag || op.tag || !b.tag) continue;
      if (op.text !== '|') continue;
      if (tagOrigin(a.tag) !== tagOrigin(b.tag)) continue;
      const prefix = getStrictPrefix(a.tag, b.tag);
      if (prefix) {
        const origin = tagOrigin(a.tag);
        const as = access(a.tag) + localTag(a.tag).substring(prefix.length + 1);
        const bs = access(b.tag) + localTag(b.tag).substring(prefix.length + 1);
        if (!as.startsWith('{')) {
          result[i].tag = prefix + '/{' + as + ',' + bs + '}' + origin;
        } else {
          result[i].tag = prefix + '/' + as.substring(0, as.length - 1) + ',' + bs + '}' + origin;
        }
        result.splice(i + 1, 2);
        i--;
      }
    }
    for (let i = 0; i < result.length - 2; i++) {
      const op1 = result[i];
      const a = result[i + 1];
      const op2 = result[i + 2];
      if (a.tag && op1.text === '(' && op2.text === ')') {
        result.splice(i + 2, 1);
        result.splice(i, 1);
      }
    }
    return result.flatMap(c => {
      if (!c.tag) c.text = this.store.account.querySymbol(...c.text.split('') as any);
      if (c.tag) return this.tagCrumbs(c.tag, c.pos, c.len);
      return c;
    });
  }

  private tagCrumbs(tag: string, pos: number, len: number) {
    let read = pos;
    const crumbs: Crumb[] = localTag(tag).split(/([/{},])/g).filter(t => !!t).map(text => {
      const pos = read;
      const len = text.length;
      read += len;
      return ({text, pos, len});
    });
    let prefix = '';
    for (let i = 0; i < crumbs.length; i++) {
      const previous = i > 1 ? crumbs[i-2].tag + '/' : '';
      if (crumbs[i].text === '{') {
        prefix = previous;
      }
      if (!/[/{},]/g.test(crumbs[i].text)) {
        crumbs[i].tag = (prefix || previous) + crumbs[i].text;
      } else {
        crumbs[i].text = this.store.account.querySymbol(crumbs[i].text as any);
      }
    }
    const origin = tagOrigin(tag);
    if (origin) {
      for (const t of crumbs) {
        if (t.tag) t.tag += origin;
      }
      crumbs.push({text: ' ', pos, len: 0 });
      crumbs.push({text: origin, tag: origin, pos: pos + len - origin.length, len: origin.length });
    }
    if (tag.startsWith('!')) {
      for (const t of crumbs) {
        if (t.text.startsWith('!')) t.text = t.text.substring(1);
      }
      const notOp = { text: this.store.account.querySymbol('!'), pos, len: 0 };
      if (notOp.text.startsWith(' ')) {
        crumbs.unshift(notOp);
      } else {
        crumbs.push(notOp);
      }
    }
    for (const t of crumbs) {
      const tag = t.tag?.startsWith('!') ? t.tag.substring(1) : t.tag;
      if (tag && !tag.startsWith('@')) {
        this.exts.getCachedExt(tag).subscribe(ext => {
          if (ext.modifiedString && ext.name) {
            t.text = ext.name;
          } else if (ext.tag === 'plugin') {
            t.text = '📦';
          } else if (ext.tag === '+plugin') {
            t.text = '+📦';
          } else if (ext.tag === '_plugin') {
            t.text = '_📦';
          } else {
            const template = this.admin.getTemplate(ext.tag);
            if (template?.name) {
              t.text = template.name;
            } else {
              const plugin = this.admin.getPlugin(ext.tag);
              if (plugin?.name) t.text = plugin.name;
            }
          }
          this.cd.detectChanges();
        });
      }
    }
    return crumbs;
  }
}
