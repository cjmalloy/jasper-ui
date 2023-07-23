import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldType, FieldTypeConfig } from '@ngx-formly/core';

@Component({
  selector: 'formly-field-input',
  template: `
    <div class="form-array">
      <input *ngIf="type !== 'number'; else numberTmp"
             class="grow"
             [type]="type"
             [formControl]="formControl"
             [formlyAttributes]="field"
             [class.is-invalid]="showError">
      <ng-template #numberTmp>
        <input type="number"
               class="grow"
               [formControl]="formControl"
               [formlyAttributes]="field"
               [class.is-invalid]="showError">
      </ng-template>
      <app-qr-scanner *ngIf="field.type === 'qr'" (data)="$event && field.formControl!.setValue($event)"></app-qr-scanner>
      <app-audio-upload *ngIf="field.type === 'audio'" (data)="$event && field.formControl!.setValue($event)"></app-audio-upload>
      <app-video-upload *ngIf="field.type === 'video'" (data)="$event && field.formControl!.setValue($event)"></app-video-upload>
      <app-image-upload *ngIf="field.type === 'image'" (data)="$event && field.formControl!.setValue($event)"></app-image-upload>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormlyFieldInput extends FieldType<FieldTypeConfig> {
  get type() {
    return this.props.type || 'text';
  }
}
