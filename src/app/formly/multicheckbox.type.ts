import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldType, FieldTypeConfig } from '@ngx-formly/core';

@Component({
  standalone: false,
  selector: 'formly-field-multicheckbox',
  template: `
    <ng-container *ngFor="let option of props.options | formlySelectOptions: field | async; let i = index">
      <input type="checkbox"
             [id]="id + '_' + i"
             [value]="option.value"
             [checked]="isChecked(option)"
             [formlyAttributes]="field"
             [disabled]="formControl.disabled || option.disabled"
             (change)="onChange(option.value, $any($event.target).checked)"/>
      <label [for]="id + '_' + i">{{ option.label }}</label>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormlyFieldMultiCheckbox extends FieldType<FieldTypeConfig> {
  override defaultOptions = {
    props: {
      formCheck: 'default' as const, // 'default' | 'inline' | 'switch' | 'inline-switch'
    },
  };

  onChange(value: any, checked: boolean) {
    this.formControl.markAsDirty();
    if (this.props.type === 'array') {
      this.formControl.patchValue(checked
        ? [...(this.formControl.value || []), value]
        : [...(this.formControl.value || [])].filter((o) => o !== value),
      );
    } else {
      this.formControl.patchValue({ ...this.formControl.value, [value]: checked });
    }
    this.formControl.markAsTouched();
  }

  isChecked(option: any) {
    const value = this.formControl.value;

    return value && (this.props.type === 'array' ? value.indexOf(option.value) !== -1 : value[option.value]);
  }
}
