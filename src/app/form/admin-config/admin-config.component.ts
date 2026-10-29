import { Component, computed, DestroyRef, effect, inject, input, linkedSignal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UntypedFormControl, UntypedFormGroup, ValidatorFn } from '@angular/forms';
import { FormlyFieldConfig, FormlyForm, FormlyFormOptions } from '@ngx-formly/core';
import { AdminService } from '../../service/admin.service';
import { controlValue } from '../../util/form';

/**
 * Formly editor for a JSON string form control.
 */
@Component({
  selector: 'app-admin-config',
  templateUrl: './admin-config.component.html',
  styleUrls: ['./admin-config.component.scss'],
  host: { 'class': 'nested-form admin-config' },
  imports: [FormlyForm],
})
export class AdminConfigComponent {
  admin = inject(AdminService);

  readonly group = input.required<UntypedFormGroup>();
  readonly fieldName = input('config');
  readonly fields = input<FormlyFieldConfig[]>([]);

  readonly control = computed(() => this.group().get(this.fieldName()) as UntypedFormControl);
  private readonly json = controlValue(() => this.control());
  private written?: string;

  readonly model = linkedSignal<string | undefined, any>({
    source: this.json,
    computation: (value, previous) => {
      if (previous && value === this.written) return previous.value;
      try {
        return value ? JSON.parse(value) : {};
      } catch (e) {
        // Keep the last valid model while the JSON is being edited
        return previous?.value ?? {};
      }
    },
  });

  form = new UntypedFormGroup({});
  options: FormlyFormOptions = {
    formState: {
      admin: this.admin,
      config: {},
    },
  };

  private formValidator: ValidatorFn = () => this.form.invalid ? { adminForm: true } : null;

  constructor() {
    // Sync the model into the formly form state
    effect(() => {
      this.options.formState.config = this.model();
    });
    // Sync the formly form validity into the JSON control validators
    effect(onCleanup => {
      const control = this.control();
      untracked(() => {
        control.addValidators(this.formValidator);
        control.updateValueAndValidity({ emitEvent: false });
      });
      onCleanup(() => {
        control.removeValidators(this.formValidator);
        control.updateValueAndValidity({ emitEvent: false });
      });
    });
    this.form.statusChanges.pipe(
      takeUntilDestroyed(inject(DestroyRef)),
    ).subscribe(() => untracked(() => this.control()).updateValueAndValidity({ emitEvent: false }));
  }

  modelChange(model: any) {
    this.written = JSON.stringify(model, null, 2);
    const control = this.control();
    control.setValue(this.written);
    control.markAsDirty();
  }
}
