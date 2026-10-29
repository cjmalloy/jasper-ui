import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, signal, untracked } from '@angular/core';
import {
  ReactiveFormsModule,
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup,
  Validators
} from '@angular/forms';
import { FormlyConfig, FormlyFormBuilder } from '@ngx-formly/core';
import { cloneDeep, isEqual } from 'lodash-es';
import { v4 as uuid } from 'uuid';
import { generateDefaults, generateSchema, groupFormFields, optionalFields } from '../../formly/formly-schema';
import { formBuilderFields } from '../../formly/formly.type';
import { AdminService } from '../../service/admin.service';
import { controlValue } from '../../util/form';
import { AdminConfigComponent } from '../admin-config/admin-config.component';
import { JsonComponent } from '../json/json.component';

@Component({
  selector: 'app-template-form',
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.scss'],
  host: { 'class': 'nested-form' },
  imports: [ReactiveFormsModule, JsonComponent, AdminConfigComponent, NgTemplateOutlet]
})
export class TemplateFormComponent {
  private admin = inject(AdminService);
  private formlyConfig = inject(FormlyConfig);
  private formlyBuilder = inject(FormlyFormBuilder);

  private readonly rootControlState = controlValue(() => this.group());

  private readonly controlState0 = controlValue(() => this.group().get('config'));
  private readonly controlState1 = controlValue(() => this.group().get('defaults'));
  private readonly controlState2 = controlValue(() => this.group().get('schema'));


  readonly group = input.required<UntypedFormGroup>();
  readonly configErrors = input<string[]>([]);
  readonly defaultsErrors = input<string[]>([]);
  readonly schemaErrors = input<string[]>([]);

  id = 'template-' + uuid();
  readonly editingConfig = signal<any>(false);
  readonly editingDefaults = signal<any>(false);
  readonly editingSchema = signal<any>(false);
  readonly formBuilderOpen = signal(false);
  readonly formBuilder = formBuilderFields();

  private readonly initialTag = computed(() => {
    const group = this.group();
    return untracked(() => group.get('tag')?.value) || '';
  });
  readonly adminForm = computed(() => cloneDeep(this.admin.getTemplateAdminForm(this.initialTag(), 'adminForm')));
  readonly advancedAdminForm = computed(() => cloneDeep(this.admin.getTemplateAdminForm(this.initialTag(), 'advancedAdminForm')));

  readonly tag = computed(() => {
    this.rootControlState();
    return this.group().get('tag') as UntypedFormControl;
  });

  readonly name = computed(() => {
    this.rootControlState();
    return this.group().get('name') as UntypedFormControl;
  });

  readonly config = computed(() => {
    this.rootControlState();
    this.controlState0();
    return this.editingConfig() || this.group().get('config')?.value;
  });

  readonly defaults = computed(() => {
    this.rootControlState();
    this.controlState1();
    return this.editingDefaults() || this.group().get('defaults')?.value;
  });

  readonly schema = computed(() => {
    this.rootControlState();
    this.controlState2();
    return this.editingSchema() || this.group().get('schema')?.value;
  });

  readonly formFields = computed(() => {
    this.rootControlState();
    this.controlState0();
    return groupFormFields(this.group());
  }, { equal: isEqual });

  readonly defaultsForm = computed(() => optionalFields(this.formlyConfig, this.formFields()));

  generateSchema() {
    generateSchema(this.formlyConfig, this.group());
  }

  generateDefaults() {
    generateDefaults(this.formlyConfig, this.formlyBuilder, this.group());
  }

  readonly jsonErrors = computed(() => !!(this.configErrors().length || this.defaultsErrors().length || this.schemaErrors().length));

  validate(input: HTMLInputElement) {
    if (this.name().touched) {
      if (this.name().errors?.['required']) {
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
