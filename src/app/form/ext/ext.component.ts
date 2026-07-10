import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  ChangeDetectionStrategy
} from '@angular/core';
import {
  FormControl,
  ReactiveFormsModule,
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup,
  Validators
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FormlyFieldConfig, FormlyForm, FormlyFormOptions } from '@ngx-formly/core';
import { cloneDeep, defer, uniq } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, of, Subject, takeUntil } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { LoadingComponent } from '../../component/loading/loading.component';
import { RefComponent } from '../../component/ref/ref.component';
import { Ext } from '../../model/ext';
import { Ref } from '../../model/ref';
import { getMailbox } from '../../mods/mailbox';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { Store } from '../../store/store';
import { TAG_REGEX } from '../../util/format';
import { convertFilter, convertSort, defaultDesc, FilterItem, negatable, toggle, UrlFilter } from '../../util/query';
import { hasPrefix } from '../../util/tag';
import { EditorComponent } from '../editor/editor.component';
import { linksForm } from '../links/links.component';
import { themesForm, ThemesFormComponent } from '../themes/themes.component';

@Component({
  selector: 'app-ext-form',
  templateUrl: './ext.component.html',
  styleUrls: ['./ext.component.scss'],
  host: { 'class': 'nested-form' },
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    forwardRef(() => RefComponent),
    forwardRef(() => EditorComponent),
    ReactiveFormsModule,
    FormlyForm,
    CdkDropListGroup,
    RouterLink,
    ThemesFormComponent,
    LoadingComponent,
  ],
})
export class ExtFormComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  allSorts = this.admin.refSorts.map(convertSort);
  allFilters: FilterItem[] = [
    { filter: `modified/before/${DateTime.now().toISO()}`, label: $localize`🕓️ modified before` },
    { filter: `modified/after/${DateTime.now().toISO()}`, label: $localize`🕓️ modified after` },
    { filter: `response/before/${DateTime.now().toISO()}`, label: $localize`🧵️ response before` },
    { filter: `response/after/${DateTime.now().toISO()}`, label: $localize`🧵️ response after` },
    { filter: `published/before/${DateTime.now().toISO()}`, label: $localize`📅️ published before` },
    { filter: `published/after/${DateTime.now().toISO()}`, label: $localize`📅️ published after` },
    { filter: `created/before/${DateTime.now().toISO()}`, label: $localize`✨️ created before` },
    { filter: `created/after/${DateTime.now().toISO()}`, label: $localize`✨️ created after` },
    ...this.admin.filters.map(convertFilter),
  ];

  @Input()
  group!: UntypedFormGroup;
  @Input()
  showClear = false;
  @Output()
  clear = new EventEmitter<void>();

  @ViewChild('fillPopover')
  fillPopover?: ElementRef;
  @ViewChild('fillSidebar')
  fillSidebar?: ElementRef;
  @ViewChild('mainFormlyForm')
  mainFormlyForm?: FormlyForm;
  @ViewChild('advancedFormlyForm')
  advancedFormlyForm?: FormlyForm;

  id = 'ext-' + uuid();
  form?: FormlyFieldConfig[];
  advancedForm?: FormlyFieldConfig[];
  loadingDefaults = false;
  defaults?: Ref;

  options: FormlyFormOptions = {
    formState: {
      admin: this.admin,
      config: { }
    }
  };

  private tag?: string;

  constructor(
    public admin: AdminService,
    public store: Store,
    private refs: RefService,
    private cd: ChangeDetectorRef,
  ) { }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get user() {
    if (!this.admin.getTemplate('user')) return false;
    return hasPrefix(this.group.get('tag')!.value, 'user');
  }

  get config() {
    return this.group.get('config') as UntypedFormGroup;
  }

  get inbox() {
    if (!this.admin.getPlugin('plugin/inbox')) return null;
    return getMailbox(this.group.get('tag')!.value, this.store.account.origin);
  }

  get modmail() {
    return this.config.get('modmail') as FormControl<boolean>;
  }

  get defaultSort() {
    return this.config.get('defaultSort') as FormControl<string[]>;
  }

  get defaultFilter() {
    return this.config.get('defaultFilter') as FormControl<UrlFilter[]>;
  }

  addSort(value: string, select: HTMLSelectElement) {
    if (!value) return;
    this.defaultSort.setValue([
      ...this.defaultSort.value || [],
      value + ',' + (defaultDesc(value) ? 'DESC' : 'ASC'),
    ]);
    select.selectedIndex = 0;
  }

  sortCol(sort: string) {
    if (!sort.includes(',')) return sort;
    return sort.split(',')[0];
  }

  sortDir(sort: string) {
    if (!sort.includes(',')) return defaultDesc(sort) ? 'DESC' : 'ASC';
    return sort.split(',')[1].toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  }

  setSortCol(index: number, value: string) {
    const sorts = [...this.defaultSort.value];
    sorts[index] = value + ',' + this.sortDir(value);
    this.defaultSort.setValue(sorts);
  }

  setSortDir(index: number, value: string) {
    const sorts = [...this.defaultSort.value];
    sorts[index] = this.sortCol(sorts[index]) + ',' + value;
    this.defaultSort.setValue(sorts);
  }

  removeSort(index: number) {
    const sorts = [...this.defaultSort.value];
    sorts.splice(index, 1);
    this.defaultSort.setValue(sorts);
  }

  addFilter(value: UrlFilter, select: HTMLSelectElement) {
    if (!value) return;
    this.defaultFilter.setValue([...this.defaultFilter.value || [], value]);
    select.selectedIndex = 0;
  }

  setFilter(index: number, value: UrlFilter) {
    const filters = [...this.defaultFilter.value];
    filters[index] = value;
    this.defaultFilter.setValue(filters);
  }

  removeFilter(index: number) {
    const filters = [...this.defaultFilter.value];
    filters.splice(index, 1);
    this.defaultFilter.setValue(filters);
  }

  toggleFilter(index: number) {
    const filters = [...this.defaultFilter.value];
    filters[index] = toggle(filters[index])!;
    this.defaultFilter.setValue(filters);
  }

  setFilterDate(index: number, filter: UrlFilter, date: string) {
    if (!date) return;
    this.setFilter(index, (filter.substring(0, filter.lastIndexOf('/') + 1) + DateTime.fromISO(date).toISO()) as UrlFilter);
  }

  filterDate(filter: UrlFilter) {
    const date = DateTime.fromISO(filter.substring(filter.lastIndexOf('/') + 1));
    return date.isValid ? date.toFormat("yyyy-MM-dd'T'T") : '';
  }

  get sidebar() {
    return this.config.get('sidebar') as UntypedFormControl;
  }

  get popover() {
    return this.config.get('popover') as UntypedFormControl;
  }

  get themes() {
    return this.config.get('themes') as UntypedFormGroup;
  }

  get userTheme() {
    return this.config.get('userTheme') as UntypedFormGroup;
  }

  get themeValues() {
    return uniq([...Object.keys(this.themes?.value || {}), ...this.admin.themes.flatMap(p => Object.keys(p.config?.themes || {}))]);
  }

  get userThemeValues() {
    return uniq([...Object.keys(this.themes?.value || {}), ...this.admin.themes.flatMap(p => Object.keys(p.config?.themes || {}))]);
  }

  get pinned() {
    return this.config.get('pinned') as UntypedFormControl;
  }

  negatable(filter: string) {
    return negatable(filter);
  }

  setValue(ext: Ext) {
    this.tag = ext.tag;
    if (ext.config?.defaults) {
      this.loadingDefaults = true;
      this.refs.getCurrent('tag:/' + ext.tag)
        .subscribe(ref => {
          this.defaults = ref;
          this.loadingDefaults = false;
        });
    }
    if (!this.form) {
      this.form = cloneDeep(this.admin.getTemplateForm(ext.tag));
    }
    if (!this.advancedForm) {
      this.advancedForm = cloneDeep(this.admin.getTemplateAdvancedForm(ext.tag));
    }
    this.setModel(ext);
  }

  private setModel(ext: Ext) {
    if (!this.mainFormlyForm || !this.advancedFormlyForm) {
      this.cd.markForCheck();
      defer(() => this.setModel(ext));
      return;
    }
    this.group!.patchValue(ext);
    this.options.formState.config = ext.config;
    this.mainFormlyForm!.model = ext.config;
    // TODO: Why aren't changed being detected?
    // @ts-ignore
    this.mainFormlyForm.builder.build(this.mainFormlyForm.field);
    if (this.advancedFormlyForm) {
      this.advancedFormlyForm!.model = ext.config;
      // TODO: Why aren't changed being detected?
      // @ts-ignore
      this.advancedFormlyForm.builder.build(this.advancedFormlyForm.field);
    }
    this.config.valueChanges.pipe(
      takeUntil(this.destroy$),
    ).subscribe(value => {
      if (value.defaults) {
        if (!this.defaults) this.createDefaults();
      } else {
        delete this.defaults;
        this.loadingDefaults = false;
      }
    });
    this.cd.markForCheck();
  }

  createDefaults() {
    this.loadingDefaults = true;
    this.refs.getCurrent('tag:/' + this.tag).pipe(
      catchError(err => {
        this.defaults = {
          origin: this.store.account.origin,
          url: 'tag:/' + this.tag,
          tags: ['internal', this.store.account.localTag],
          created: DateTime.now(),
          published: DateTime.now(),
          modified: DateTime.now(),
        };
        this.refs.create(this.defaults).subscribe(cursor => this.defaults!.modifiedString = cursor);
        return of(this.defaults);
      })
    ).subscribe(ref => {
      if (!this.loadingDefaults) return;
      this.defaults = ref;
      this.loadingDefaults = false;
    });
  }
}

export function extForm(fb: UntypedFormBuilder, ext: Ext | undefined, admin: AdminService, locked: boolean) {
  let configControls = {};
  if (admin.getTemplate('') && !hasPrefix(ext?.tag, 'config')) {
    configControls = {
      ...configControls,
      defaultSort: [[]],
      defaultFilter: [[]],
      sidebar: [''],
      popover: [''],
      modmail: [false],
      pinned: linksForm(fb, ext?.config?.pinned || []),
      themes: themesForm(fb, ext?.config?.themes || []),
      theme: [''],
    };
  }
  if (admin.home && hasPrefix(ext?.tag, 'config/home')) {
    configControls = {
      ...configControls,
      defaultSort: [[]],
      defaultFilter: [[]],
      sidebar: [''],
      modmail: [false],
      pinned: linksForm(fb, ext?.config?.pinned || []),
      themes: themesForm(fb, ext?.config?.themes || []),
      theme: [''],
    };
  }
  if (admin.getTemplate('user') && hasPrefix(ext?.tag, 'user')) {
    configControls = {
      ...configControls,
      userTheme: [''],
    };
  }
  return fb.group({
    tag: [{value: '', disabled: locked}, [Validators.required, Validators.pattern(TAG_REGEX)]],
    name: [''],
    config: fb.group(configControls),
  });
}
