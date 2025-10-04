import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { v4 as uuid } from 'uuid';

@Component({
  standalone: false,
  selector: 'app-plugin-form',
  templateUrl: './plugin.component.html',
  styleUrls: ['./plugin.component.scss'],
  host: {'class': 'nested-form'}
})
export class PluginFormComponent {

  @Input()
  group!: UntypedFormGroup;
  @Input()
  configErrors: string[] = [];
  @Input()
  defaultsErrors: string[] = [];
  @Input()
  schemaErrors: string[] = [];

  id = 'plugin-' + uuid();
  editingConfig = false;
  editingDefaults = false;
  editingSchema = false;

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

export function pluginForm(fb: UntypedFormBuilder) {
  return fb.group({
    tag: [{value: '', disabled: true}, [Validators.required]],
    name: ['', [Validators.required]],
    config: [],
    defaults: [],
    schema: [],
  });
}
