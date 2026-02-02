import { ChangeDetectionStrategy, Component, Directive, ElementRef, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyAttributes, FormlyConfig } from '@ngx-formly/core';
import { Duration } from 'luxon';
import { getErrorMessage } from './errors';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'formly-field-duration',
  host: { 'class': 'field' },
  template: `
    <div class="col">
      <div class="center">{{ formatInterval(model[$any(key)]) }}</div>
      <input [duration]="props.datalist"
             type="range"
             min="0"
             [style.display]="'block'"
             [max]="props.datalist?.length || 10"
             step="1"
             (blur)="validate($any($event.target))"
             [formControl]="formControl"
             [formlyAttributes]="field"
             [class.is-invalid]="showError">
    </div>
  `,
  imports: [
    ReactiveFormsModule,
    forwardRef(() => DurationInputAccessor),
    FormlyAttributes,
  ],
})
export class FormlyFieldDuration extends FieldType<FieldTypeConfig> {

  constructor(
    private config: FormlyConfig,
  ) {
    super();
  }

  validate(input: HTMLInputElement) {
    if (this.showError) {
      input.setCustomValidity(getErrorMessage(this.field, this.config));
      input.reportValidity();
    }
  }

  formatInterval(value: string) {
    return Duration.fromISO(value).toHuman();
  }
}

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
    '(change)': 'onChange($any($event.target).value)',
    '(input)': 'onChange($any($event.target).value)',
    '(blur)': 'onTouched()'
  },
})
export class DurationInputAccessor implements ControlValueAccessor {
  onChange: any;
  onTouched: any;

  @Input('duration')
  datalist: { value: string, label: string }[] = [];

  constructor(private elementRef: ElementRef) {}

  writeValue(value: any) {
    this.elementRef.nativeElement.value = this.datalist.findIndex(o => o.value === value);
  }

  registerOnChange(fn: any) {
    this.onChange = (value: any) => {
      fn(this.datalist[value].value);
    };
  }

  registerOnTouched(fn: any) {
    this.onTouched = fn;
  }
}
