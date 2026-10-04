import { NgTemplateOutlet } from '@angular/common';
import { computed, Component, inject, input, signal, untracked } from '@angular/core';
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
import { controlValue } from '../../util/form';
import { AdminService } from '../../service/admin.service';
import { AdminConfigComponent } from '../admin-config/admin-config.component';
import { JsonComponent } from '../json/json.component';

@Component({
  selector: 'app-plugin-form',
  templateUrl: './plugin.component.html',
  styleUrls: ['./plugin.component.scss'],
  host: { 'class': 'nested-form' },
  imports: [ReactiveFormsModule, JsonComponent, AdminConfigComponent, NgTemplateOutlet]
})
export class PluginFormComponent {
  private admin = inject(AdminService);

  private readonly rootControlState = controlValue(() => this.group());

  private readonly controlState0 = controlValue(() => this.group().get('config'));
  private readonly controlState1 = controlValue(() => this.group().get('defaults'));
  private readonly controlState2 = controlValue(() => this.group().get('schema'));


  readonly group = input.required<UntypedFormGroup>();
  readonly configErrors = input<string[]>([]);
  readonly defaultsErrors = input<string[]>([]);
  readonly schemaErrors = input<string[]>([]);

  id = 'plugin-' + uuid();
  readonly editingConfig = signal<any>(false);
  readonly editingDefaults = signal<any>(false);
  readonly editingSchema = signal<any>(false);

  private readonly initialTag = computed(() => {
    const group = this.group();
    return untracked(() => group.get('tag')?.value) || '';
  });
  readonly adminForm = computed(() => cloneDeep(this.admin.getPluginAdminForm(this.initialTag(), 'adminForm')));
  readonly advancedAdminForm = computed(() => cloneDeep(this.admin.getPluginAdminForm(this.initialTag(), 'advancedAdminForm')));

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

export function pluginForm(fb: UntypedFormBuilder) {
  return fb.group({
    tag: [{value: '', disabled: true}, [Validators.required]],
    name: ['', [Validators.required]],
    config: [],
    defaults: [],
    schema: [],
  });
}
