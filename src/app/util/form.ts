import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Duration } from 'luxon';

export function intervalValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const interval = Duration.fromISO(control.value);
    return interval.isValid && interval.valueOf() ? null : { interval: { value: control.value } };
  };
}
export function scrollToFirstInvalid() {
  const control = document.querySelector('form .ng-invalid');
  if (!control) return;

  window.scroll({
    top: control.getBoundingClientRect().top + window.scrollY,
    left: 0,
    behavior: 'smooth'
  });
}
