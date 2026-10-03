import { computed, Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Duration } from 'luxon';
import { map, of, startWith, switchMap } from 'rxjs';

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
  const value = toSignal(toObservable(current).pipe(
    switchMap(control => control
      ? control.valueChanges.pipe(
        startWith(control.value),
        map(value => ({ control, value })),
      )
      : of(undefined)),
  ));
  return computed(() => {
    const control = current();
    const snapshot = value();
    // Control inputs can change before toObservable's effect switches subscriptions.
    return snapshot?.control === control ? snapshot?.value : control?.value;
  });
}

/**
 * Signal tracking state read from a reactive forms control, such as `valid` or `errors`.
 * Re-reads the state on every control event. Must be called in an injection context.
 */
export function controlState<R>(control: () => AbstractControl | null | undefined, read: (control: AbstractControl) => R): Signal<R | undefined> {
  const current = computed(control);
  const state = toSignal(toObservable(current).pipe(
    switchMap(control => control
      ? control.events.pipe(
        startWith(undefined),
        map(() => ({ control, value: read(control) })),
      )
      : of(undefined)),
  ));
  return computed(() => {
    const control = current();
    const snapshot = state();
    return snapshot?.control === control ? snapshot?.value : control ? read(control) : undefined;
  });
}
