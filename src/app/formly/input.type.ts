import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldType, FieldTypeConfig } from '@ngx-formly/core';

@Component({
  selector: 'formly-field-input',
  template: `
    <input *ngIf="type !== 'number'; else numberTmp"
           [type]="type"
           [formControl]="formControl"
           [formlyAttributes]="field"
           [class.is-invalid]="showError">
      <ng-template #numberTmp>
        <input type="number"
               [formControl]="formControl"
               [formlyAttributes]="field"
               [class.is-invalid]="showError">
      </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormlyFieldInput extends FieldType<FieldTypeConfig> {
  get type() {
    return this.props.type || 'text';
  }
}
