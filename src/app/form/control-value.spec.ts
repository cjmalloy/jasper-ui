/// <reference types="vitest/globals" />
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { controlValue } from '../util/form';

describe('controlValue', () => {
  it('returns immediate snapshots and switches away from obsolete controls', () => {
    const first = new FormControl('first', { nonNullable: true });
    const second = new FormControl('second', { nonNullable: true });
    const control = signal<FormControl<string> | undefined>(first);
    const value = TestBed.runInInjectionContext(() => controlValue(control));
    expect(value()).toBe('first');
    TestBed.tick();
    first.setValue('updated');
    expect(value()).toBe('updated');

    control.set(second);
    expect(value()).toBe('second');
    first.setValue('obsolete');
    expect(value()).toBe('second');
    TestBed.tick();
    second.setValue('current');
    expect(value()).toBe('current');

    control.set(undefined);
    expect(value()).toBeUndefined();
    TestBed.tick();
    second.setValue('obsolete');
    expect(value()).toBeUndefined();
  });

  it('invalidates child selectors when controls are dynamically added and replaced', () => {
    const group = new FormGroup<{ dynamic?: FormControl<string> }>({});
    const state = TestBed.runInInjectionContext(() => controlValue(() => group));
    const child = computed(() => {
      state();
      return group.get('dynamic');
    });
    expect(child()).toBeNull();
    TestBed.tick();
    const first = new FormControl('first', { nonNullable: true });
    group.addControl('dynamic', first);
    expect(child()).toBe(first);
    const replacement = new FormControl('replacement', { nonNullable: true });
    group.setControl('dynamic', replacement);
    expect(child()).toBe(replacement);
    group.removeControl('dynamic');
    expect(child()).toBeNull();
  });

  it('unsubscribes when the injection context is destroyed', () => {
    const control = new FormControl('initial');
    const value = TestBed.runInInjectionContext(() => controlValue(() => control));
    TestBed.tick();
    expect(value()).toBe('initial');
    TestBed.resetTestingModule();
    control.setValue('later');
    expect(value()).toBe('initial');
  });
});
