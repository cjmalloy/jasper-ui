import { Component, ElementRef, EventEmitter, HostBinding, Input, OnInit, Output, ViewChild } from '@angular/core';
import {
  FormArray,
  FormControl,
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup,
  Validators
} from '@angular/forms';
import { FormlyFieldConfig, FormlyForm, FormlyFormOptions } from '@ngx-formly/core';
import { defer, uniq } from 'lodash-es';
import { allRefSorts } from '../../component/sort/sort.component';
import { Ext } from '../../model/ext';
import { getMailbox } from '../../mods/mailbox';
import { AdminService } from '../../service/admin.service';
import { Store } from '../../store/store';
import { TAG_REGEX } from '../../util/format';
import { convertFilter, defaultDesc, negatable, toggle, UrlFilter } from '../../util/query';
import { hasPrefix } from '../../util/tag';
import { linksForm } from '../links/links.component';
import { themesForm } from '../themes/themes.component';

@Component({
  selector: 'app-ext-form',
  templateUrl: './ext.component.html',
  styleUrls: ['./ext.component.scss']
})
export class ExtFormComponent implements OnInit {
  @HostBinding('class') css = 'nested-form';
  allSorts = allRefSorts;
  allFilters = this.admin.filters.map(convertFilter);

  @Input()
  group!: UntypedFormGroup;
  @Input()
  showClear = false;
  @Output()
  clear = new EventEmitter<void>();

  @ViewChild('fill')
  fill?: ElementRef;
  @ViewChild('mainFormlyForm')
  mainFormlyForm?: FormlyForm;
  @ViewChild('advancedFormlyForm')
  advancedFormlyForm?: FormlyForm;

  form?: FormlyFieldConfig[];
  advancedForm?: FormlyFieldConfig[];

  options: FormlyFormOptions = {
    formState: {
      config: {}
    }
  };

  constructor(
    public admin: AdminService,
    public store: Store,
  ) { }

  ngOnInit(): void {
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
    return this.config.get('defaultSort') as FormArray<FormControl<string>>;
  }

  get defaultFilter() {
    return this.config.get('defaultFilter') as FormArray<FormControl<string>>;
  }

  get sortCol() {
    if (!this.defaultSort.value?.[0]) return undefined;
    if (!this.defaultSort.value[0].includes(',')) return this.defaultSort.value[0];
    return this.defaultSort.value[0].split(',')[0];
  }

  get sortDir() {
    if (!this.defaultSort.value?.[0]) return undefined;
    if (!this.defaultSort.value[0].includes(',')) return defaultDesc.includes(this.defaultSort.value[0]) ? 'DESC' : 'ASC';
    return this.defaultSort.value[0].split(',')[1].toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  }

  get filter(): UrlFilter | undefined {
    return this.defaultFilter.value[0] as UrlFilter;
  }

  setSortCol(value: string) {
    this.defaultSort.setValue([value + ',' + this.sortDir]);
  }

  setSortDir(value: string) {
    this.defaultSort.setValue([this.sortCol + ',' + value]);
  }

  setFilter(value: string | null) {
    if (value) {
      this.defaultFilter.setValue([value]);
    } else {
      this.defaultFilter.setValue([]);
    }
  }

  toggleFilter() {
    if (!this.filter) return;
    this.defaultFilter.setValue([toggle(this.filter)]);
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
    if (!this.form) {
      this.form = this.admin.getTemplateForm(ext.tag);
    }
    if (!this.advancedForm) {
      this.advancedForm = this.admin.getTemplateAdvancedForm(ext.tag);
    }
    defer(() => {
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
    });
  }
}

export function extForm(fb: UntypedFormBuilder, ext: Ext | undefined, admin: AdminService, locked: boolean) {
  let configControls = {};
  if (admin.getTemplate('')) {
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
