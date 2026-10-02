import { computed, effect, linkedSignal, Signal } from '@angular/core';
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

/**
 * Signal tracking the value of a reactive forms control.
 * Must be called in an injection context.
 */
export function controlValue<T = any>(control: () => AbstractControl<T> | null | undefined): Signal<T | undefined> {
  const current = computed(control);
  const value = linkedSignal(() => current()?.value);
  effect(onCleanup => {
    const c = current();
    if (!c) return;
    value.set(c.value);
    const sub = c.valueChanges.subscribe(v => value.set(v));
    onCleanup(() => sub.unsubscribe());
  });
  return value.asReadonly();
}
