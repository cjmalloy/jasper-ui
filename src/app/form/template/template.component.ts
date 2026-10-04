import { controlValue } from '../../util/form';
import { computed, Component, input, signal } from '@angular/core';
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
  imports: [ReactiveFormsModule, JsonComponent]
})
export class TemplateFormComponent {
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
