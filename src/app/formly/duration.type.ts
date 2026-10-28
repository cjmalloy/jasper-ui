import { Component, Directive, ElementRef, forwardRef, inject, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyAttributes, FormlyConfig } from '@ngx-formly/core';
import { Duration } from 'luxon';
import { getErrorMessage } from './errors';

@Component({
  selector: 'formly-field-duration',
  host: { 'class': 'field' },
  template: `
    <div class="col">
      <div class="center">{{ formatInterval(model[$any(key)], props.datalist) }}</div>
      <input [duration]="props.datalist"
             type="range"
             min="0"
             [style.display]="'block'"
             [max]="(props.datalist?.length || 11) - 1"
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
  private config = inject(FormlyConfig);


  validate(input: HTMLInputElement) {
    if (this.showError) {
      input.setCustomValidity(getErrorMessage(this.field, this.config));
      input.reportValidity();
    }
  }

  formatInterval(value: string | number, datalist?: DurationOption[]) {
    const option = datalist?.[durationIndex(datalist, value)];
    if (option && sameDuration(option.value, value)) return option.label;
    const d = toDuration(value);
    return d?.isValid ? d.toHuman() : String(value ?? '');
  }
}

export interface DurationOption {
  value: string;
  label: string;
}

/**
 * Parse an ISO-8601 duration, or a number of seconds.
 */
export function toDuration(value: string | number | null | undefined): Duration | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') return Duration.fromMillis(value * 1000);
  return Duration.fromISO(value);
}

function sameDuration(a: string | number, b: string | number) {
  if (a === b) return true;
  const da = toDuration(a);
  const db = toDuration(b);
  return !!da?.isValid && !!db?.isValid && da.toMillis() === db.toMillis();
}

/**
 * Slider position for a value. Values not in the list use the nearest option.
 */
export function durationIndex(datalist: DurationOption[] | undefined, value: string | number | null | undefined) {
  if (!datalist?.length) return 0;
  const exact = datalist.findIndex(o => o.value === value);
  if (exact >= 0) return exact;
  const d = toDuration(value);
  if (!d?.isValid) return 0;
  const millis = d.toMillis();
  let best = 0;
  let bestDiff = Infinity;
  datalist.forEach((o, i) => {
    const diff = Math.abs((toDuration(o.value)?.toMillis() ?? 0) - millis);
    if (diff < bestDiff) {
      best = i;
      bestDiff = diff;
    }
  });
  return best;
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
  private elementRef = inject(ElementRef);

  onChange: any;
  onTouched: any;

  readonly datalist = input<DurationOption[]>([], { alias: "duration" });

  writeValue(value: any) {
    this.elementRef.nativeElement.value = durationIndex(this.datalist(), value);
  }

  registerOnChange(fn: any) {
    this.onChange = (value: any) => {
      const option = this.datalist()[value];
      if (option) fn(option.value);
    };
  }

  registerOnTouched(fn: any) {
    this.onTouched = fn;
  }
}
