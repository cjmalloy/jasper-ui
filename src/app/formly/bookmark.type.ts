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
import { debounce, defer, uniqBy } from 'lodash-es';
import { forkJoin, map, Observable, of, Subscription, switchMap } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Crumb } from '../component/query/query.component';
import { Config } from '../model/tag';
import { AdminService } from '../service/admin.service';
import { ExtService } from '../service/api/ext.service';
import { EditorService } from '../service/editor.service';
import { Store } from '../store/store';
import { convertSort, defaultDesc, SortItem } from '../util/query';
import { access, fixClientQuery, getStrictPrefix, localTag, tagOrigin } from '../util/tag';
import { getErrorMessage } from './errors';

@Component({
  selector: 'formly-field-bookmark-input',
  host: { 'class': 'field' },
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
      width: calc(100% - 28px);
      height: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding-block: 2px;
      padding-inline: 8px;
      * {
        color: var(--text);
        text-decoration: none;
        cursor: text;
      }
      .op {
        font-family: KaTeX_Main, "Times New Roman", serif;
      }
      .param {
        color: var(--active);
        font-size: 0.85em;
        margin-inline-start: 4px;
      }
    }
    .params-btn {
      flex-shrink: 0;
      padding: 0 4px;
      cursor: pointer;
    }
    .params-panel {
      background: var(--bg);
      border: 1px solid var(--border);
      padding: 8px;
      min-width: 260px;
      max-width: 400px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      z-index: 1000;
    }
    .params-panel .section-label {
      font-size: 0.85em;
      color: var(--active);
      font-weight: bold;
    }
    .params-panel .row {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .params-panel input[type=text] {
      flex: 1;
      min-width: 0;
    }
    .params-panel select {
      flex: 1;
      min-width: 0;
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
           [style.display]="preview ? 'block' : 'none'"
           (click)="$event.target === div && edit(input, false)">
        @for (breadcrumb of breadcrumbs; track breadcrumb) {
          <span class="crumb">
            @if (breadcrumb.tag) {
              <a class="tag" [routerLink]="['/tag', breadcrumb.tag]" queryParamsHandling="merge"><span (click)="clickPreview(input, $event, breadcrumb)">{{ breadcrumb.text }}</span></a>
            } @else {
              <span class="op" (click)="edit(input, breadcrumb)">{{ breadcrumb.text }}</span>
            }
          </span>
        }
        @if (paramSummary) {
          <span class="param">{{ paramSummary }}</span>
        }
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
             [value]="queryPart"
             (input)="onQueryInput(input.value)"
             (blur)="blur(input)"
             (focusin)="edit(input, false)"
             (focus)="edit(input, false)"
             (focusout)="getPreview(queryPart)"
             [formlyAttributes]="field"
             [class.is-invalid]="showError">
      <button #paramsButton
              type="button"
              class="params-btn"
              i18n-title
              title="Configure search, sort and filters"
              (click)="toggleParams()">⚙️</button>
    </div>
    <ng-template #paramsPanel>
      <div class="params-panel" (click)="$event.stopPropagation()">
        <div class="section-label" i18n>🔍️ Search</div>
        <div class="row">
          <input type="text"
                 [ngModel]="searchText"
                 (ngModelChange)="setSearch($event)"
                 i18n-placeholder
                 placeholder="Search text…">
        </div>
        <div class="section-label" i18n>🔼️ Sort</div>
        <select (change)="addSort($any($event.target).value); $any($event.target).selectedIndex = 0">
          <option value="" i18n>+ Add sort…</option>
          @for (s of allSorts; track s.value) {
            <option [value]="s.value">{{ s.label }}</option>
          }
        </select>
        @for (sort of sorts; track sort; let i = $index) {
          <div class="row">
            <select [ngModel]="sortCol(sort)" (ngModelChange)="setSortCol(i, $event)">
              @for (s of allSorts; track s.value) {
                <option [value]="s.value">{{ s.label }}</option>
              }
            </select>
            <button type="button"
                    (click)="setSortDir(i, sortDir(sort) === 'ASC' ? 'DESC' : 'ASC')"
                    [title]="sortDir(sort)">
              {{ sortDir(sort) === 'DESC' ? '🔽️' : '🔼️' }}
            </button>
            <button type="button" (click)="removeSort(i)" i18n>–</button>
          </div>
        }
        <div class="section-label" i18n>⚙️ Filters</div>
        @for (f of filters; track f; let i = $index) {
          <div class="row">
            <input type="text"
                   [ngModel]="f"
                   (ngModelChange)="setFilter(i, $event)"
                   i18n-placeholder
                   placeholder="e.g. obsolete, query/science">
            <button type="button" (click)="removeFilter(i)" i18n>–</button>
          </div>
        }
        <button type="button" (click)="addFilter()" i18n>+ Add filter</button>
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

  @ViewChild('paramsButton')
  paramsButton!: ElementRef<HTMLButtonElement>;

  @ViewChild('paramsPanel')
  paramsPanel!: TemplateRef<any>;

  listId = 'list-' + uuid();
  breadcrumbs: Crumb[] = [];
  editing = false;
  autocomplete: { value: string, label: string }[] = [];

  sorts: string[] = [];
  filters: string[] = [];
  searchText = '';

  private overlayRef?: OverlayRef;
  private overlayEvents?: Subscription;
  private showedError = false;
  private searching?: Subscription;
  private formChanges?: Subscription;
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
        }
      }
    });
  }

  ngOnDestroy() {
    this.searching?.unsubscribe();
    this.formChanges?.unsubscribe();
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

  get paramSummary(): string {
    const parts: string[] = [];
    if (this.sorts.length) {
      parts.push('🔼️ ' + this.sortCol(this.sorts[0]));
      if (this.sorts.length > 1) parts.push(`+${this.sorts.length - 1}`);
    }
    if (this.searchText) {
      parts.push('🔍️ ' + this.searchText);
    }
    if (this.filters.filter(f => !!f).length) {
      parts.push('⚙️' + this.filters.filter(f => !!f).length);
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

  private syncParams(value: string) {
    const idx = value.indexOf('?');
    if (idx === -1) {
      this.sorts = [];
      this.filters = [];
      this.searchText = '';
      return;
    }
    const params = new URLSearchParams(value.substring(idx + 1));
    this.sorts = params.getAll('sort');
    this.filters = params.getAll('filter');
    this.searchText = params.get('search') || '';
  }

  private buildParamsString(): string {
    const params = new URLSearchParams();
    // Skip empty or incomplete sorts (e.g. ',ASC' before column is selected)
    this.sorts.filter(s => !!s && !s.startsWith(',')).forEach(s => params.append('sort', s));
    this.filters.filter(f => !!f).forEach(f => params.append('filter', f));
    if (this.searchText) params.set('search', this.searchText);
    return params.toString();
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
    const paramsStr = this.paramsString;
    this.formControl.setValue(paramsStr ? `${value}?${paramsStr}` : value);
    this.formControl.markAsDirty();
    this.search(value);
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
      this.getPreview(input.value);
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
  addFilter() {
    this.filters.push('');
    this.cd.detectChanges();
  }

  setFilter(index: number, value: string) {
    this.filters[index] = value;
    this.updateFormValue();
  }

  removeFilter(index: number) {
    this.filters.splice(index, 1);
    this.updateFormValue();
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
        .flexibleConnectedTo(this.paramsButton)
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
