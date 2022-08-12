import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import * as moment from 'moment';

export function intervalValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const interval = moment.duration(control.value);
    return interval.isValid() && interval.valueOf() > 0 ? null : { interval: { value: control.value } };
  };
}
