import { ChangeDetectionStrategy, Component, Directive, ElementRef, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { FieldType, FieldTypeConfig } from '@ngx-formly/core';
import * as moment from 'moment';

@Component({
  selector: 'formly-field-input',
  template: `
    <input duration
           class="grow"
           type="text"
           [formControl]="formControl"
           [formlyAttributes]="field"
           [class.is-invalid]="showError">
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormlyFieldDuration extends FieldType<FieldTypeConfig> {}

@Directive({
  selector: '[duration]',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DurationInputAccessor),
      multi: true
    },
  ],
  host: {
    '(change)': 'onChange($event.target.value)',
    '(input)': 'onChange($event.target.value)',
    '(blur)': 'onTouched()'
  },
})
export class DurationInputAccessor implements ControlValueAccessor {
  onChange: any;
  onTouched: any;

  constructor(private elementRef: ElementRef) {}

  writeValue(value: any) {
    this.elementRef.nativeElement.value = value || '';
  }

  registerOnChange(fn: any) {
    this.onChange = (value: any) => {
      fn(moment.duration(value));
    };
  }

  registerOnTouched(fn: any) {
    this.onTouched = fn;
  }
}
