import { Component, ElementRef, EventEmitter, HostBinding, Input, OnInit, Output, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { FormlyFieldConfig, FormlyForm, FormlyFormOptions } from '@ngx-formly/core';
import { defer, uniq } from 'lodash-es';
import { Ext } from '../../model/ext';
import { getMailbox } from '../../mods/mailbox';
import { AdminService } from '../../service/admin.service';
import { TAG_REGEX } from '../../util/format';
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

  @Input()
  group!: UntypedFormGroup;
  @Input()
  showClear = false;
  @Output()
  clear = new EventEmitter<void>();

  @ViewChild('fill')
  fill?: ElementRef;
  @ViewChild(FormlyForm)
  formlyForm?: FormlyForm;

  form?: FormlyFieldConfig[];
  advancedForm?: FormlyFieldConfig[];

  options: FormlyFormOptions = {
  };

  constructor(
    private fb: UntypedFormBuilder,
    private admin: AdminService,
  ) { }

  ngOnInit(): void {
  }

  get config() {
    return this.group.get('config') as UntypedFormGroup;
  }

  get inbox() {
    if (!this.admin.status.plugins.inbox) return null;
    if (hasPrefix(this.group.get('tag')!.value, 'user')) return null;
    return getMailbox(this.group.get('tag')!.value);
  }

  get modmail() {
    return this.config.get('modmail') as UntypedFormControl;
  }

  get sidebar() {
    return this.config.get('sidebar') as UntypedFormControl;
  }

  get themes() {
    return this.config.get('themes') as UntypedFormGroup;
  }

  get userThemes() {
    return this.config.get('userThemes') as UntypedFormGroup;
  }

  get themeValues() {
    return uniq([...Object.keys(this.themes?.value), ...this.admin.themes.flatMap(p => Object.keys(p.config!.themes!))]);
  }

  get userThemeValues() {
    return uniq([...Object.keys(this.userThemes?.value), ...this.admin.themes.flatMap(p => Object.keys(p.config!.themes!))]);
  }

  get theme() {
    return this.config.get('theme') as UntypedFormControl;
  }

  get pinned() {
    return this.config.get('pinned') as UntypedFormControl;
  }

  get userTheme() {
    return this.config.get('userTheme') as UntypedFormControl;
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
      this.formlyForm!.model = ext.config;
      // TODO: Why aren't changed being detected?
      // @ts-ignore
      this.formlyForm.builder.build(this.formlyForm.field);
    });
  }
}

export function extForm(fb: UntypedFormBuilder, ext: Ext, admin: AdminService, locked: boolean) {
  let configControls = {};
  if (admin.status.templates.root) {
    configControls = {
      ...configControls,
      sidebar: [''],
      modmail: [false],
      pinned: linksForm(fb, ext.config?.pinned || []),
      themes: themesForm(fb, ext.config?.themes || []),
      theme: [''],
    };
  }
  return fb.group({
    tag: [{value: '', disabled: locked}, [Validators.required, Validators.pattern(TAG_REGEX)]],
    name: [''],
    config: fb.group(configControls),
  });
}
