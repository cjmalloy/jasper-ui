import { NgTemplateOutlet } from '@angular/common';
import { Component, Input, ChangeDetectionStrategy, OnInit } from '@angular/core';
import {
  ReactiveFormsModule,
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup,
  Validators
} from '@angular/forms';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { cloneDeep } from 'lodash-es';
import { v4 as uuid } from 'uuid';
import { AdminService } from '../../service/admin.service';
import { AdminConfigComponent } from '../admin-config/admin-config.component';
import { JsonComponent } from '../json/json.component';

@Component({
  selector: 'app-template-form',
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.scss'],
  host: { 'class': 'nested-form' },
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ReactiveFormsModule, JsonComponent, AdminConfigComponent, NgTemplateOutlet]
})
export class TemplateFormComponent implements OnInit {

  @Input()
  group!: UntypedFormGroup;
  @Input()
  configErrors: string[] = [];
  @Input()
  defaultsErrors: string[] = [];
  @Input()
  schemaErrors: string[] = [];

  id = 'template-' + uuid();
  editingConfig = false;
  editingDefaults = false;
  editingSchema = false;
  adminForm: FormlyFieldConfig[] = [];
  advancedAdminForm: FormlyFieldConfig[] = [];

  constructor(
    private admin: AdminService,
  ) { }

  ngOnInit() {
    const tag = this.tag?.value || '';
    this.adminForm = cloneDeep(this.admin.getTemplateAdminForm(tag, 'adminForm'));
    this.advancedAdminForm = cloneDeep(this.admin.getTemplateAdminForm(tag, 'advancedAdminForm'));
  }

  get tag() {
    return this.group.get('tag') as UntypedFormControl;
  }

  get name() {
    return this.group.get('name') as UntypedFormControl;
  }

  get config() {
    return this.editingConfig ||= this.group.get('config')?.value;
  }

  get defaults() {
    return this.editingDefaults ||= this.group.get('defaults')?.value;
  }

  get schema() {
    return this.editingSchema ||= this.group.get('schema')?.value;
  }

  get jsonErrors() {
    return !!(this.configErrors.length || this.defaultsErrors.length || this.schemaErrors.length);
  }

  validate(input: HTMLInputElement) {
    if (this.name.touched) {
      if (this.name.errors?.['required']) {
        input.setCustomValidity($localize`Name must not be blank.`);
        input.reportValidity();
      }
    }
  }

}

export function templateForm(fb: UntypedFormBuilder) {
  return fb.group({
    tag: [{value: '', disabled: true}, [Validators.required]],
    name: ['', [Validators.required]],
    config: [],
    defaults: [],
    schema: [],
  });
}
