/// <reference types="vitest/globals" />
import { FormControl } from '@angular/forms';
import { FormlyFieldBbox } from './bbox.type';

describe('FormlyFieldBbox', () => {
  function createComponent(value?: number[]) {
    const component = new FormlyFieldBbox();
    const formControl = new FormControl<any>(value);
    component.field = { formControl } as any;
    return { component, formControl };
  }

  it('clears the bbox when all four sides are emptied', () => {
    const { component, formControl } = createComponent([-65, 44, -62, 45]);
    component.set(0, '');
    expect(formControl.value).toEqual([0, 44, -62, 45]);
    expect(component.value(0)).toBe('');
    component.set(1, '');
    component.set(2, '');
    expect(component.value(1)).toBe('');
    component.set(3, '');
    expect(formControl.value).toBeUndefined();
  });

  it('clears a 3D bbox when all four geographic sides are emptied', () => {
    const { component, formControl } = createComponent([-65, 44, 0, -62, 45, 100]);
    for (let i = 0; i < 4; i++) component.set(i, '');
    expect(formControl.value).toBeUndefined();
  });

  it('keeps unset sides blank while entering a new bbox', () => {
    const { component, formControl } = createComponent();
    component.set(0, '-65');
    expect(formControl.value).toEqual([-65, 0, 0, 0]);
    expect(component.value(1)).toBe('');
    component.set(0, '');
    expect(formControl.value).toBeUndefined();
  });

  it('resets blank state when the value changes externally', () => {
    const { component, formControl } = createComponent([-65, 44, -62, 45]);
    component.set(0, '');
    formControl.setValue([1, 2, 3, 4]);
    expect(component.value(0)).toBe(1);
  });
});
