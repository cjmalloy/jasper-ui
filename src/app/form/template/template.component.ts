import { Component, ChangeDetectionStrategy, input } from '@angular/core';
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
  selector: 'app-template-form',
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.scss'],
  host: { 'class': 'nested-form' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, JsonComponent]
})
export class TemplateFormComponent {

  readonly groupInput = input.required<UntypedFormGroup>({ alias: 'group' });
  readonly configErrors = input<string[]>([]);
  readonly defaultsErrors = input<string[]>([]);
  readonly schemaErrors = input<string[]>([]);

  id = 'template-' + uuid();
  editingConfig = false;
  editingDefaults = false;
  editingSchema = false;

  get group(): UntypedFormGroup {
    return this.groupInput();
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
