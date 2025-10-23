import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Duration } from 'luxon';
import { TAG_REGEX, URI_REGEX } from './format';

export const tagValidators = [Validators.pattern(TAG_REGEX)];
export const linkValidators = [Validators.pattern(URI_REGEX)];

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
