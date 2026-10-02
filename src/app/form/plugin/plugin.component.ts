import { Component, ChangeDetectionStrategy, input, signal } from '@angular/core';
import {
  ReactiveFormsModule,
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup,
  Validators
} from '@angular/forms';
import { v4 as uuid } from 'uuid';
import { JsonComponent } from '../json/json.component';

@Component({
  selector: 'app-plugin-form',
  templateUrl: './plugin.component.html',
  styleUrls: ['./plugin.component.scss'],
  host: { 'class': 'nested-form' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, JsonComponent]
})
export class PluginFormComponent {

  readonly group = input.required<UntypedFormGroup>();
  readonly configErrors = input<string[]>([]);
  readonly defaultsErrors = input<string[]>([]);
  readonly schemaErrors = input<string[]>([]);

  id = 'plugin-' + uuid();
  readonly editingConfig = signal<any>(false);
  readonly editingDefaults = signal<any>(false);
  readonly editingSchema = signal<any>(false);



  get tag() {
    return this.group().get('tag') as UntypedFormControl;
  }

  get name() {
    return this.group().get('name') as UntypedFormControl;
  }

  get config() {
    return this.editingConfig() || this.group().get('config')?.value;
  }

  get defaults() {
    return this.editingDefaults() || this.group().get('defaults')?.value;
  }

  get schema() {
    return this.editingSchema() || this.group().get('schema')?.value;
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

export function pluginForm(fb: UntypedFormBuilder) {
  return fb.group({
    tag: [{value: '', disabled: true}, [Validators.required]],
    name: ['', [Validators.required]],
    config: [],
    defaults: [],
    schema: [],
  });
}
