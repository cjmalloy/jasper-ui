/// <reference types="vitest/globals" />
import { FormArray, FormControl } from '@angular/forms';
import { FieldArrayType } from '@ngx-formly/core';
import { vi } from 'vitest';
import { ListTypeComponent } from './list.type';
import { closedRings } from './location-picker';

describe('ListTypeComponent', () => {
  function createComponent() {
    const component = new ListTypeComponent({ hotkey: false } as any);
    const patchValue = vi.fn();
    component.field = {
      fieldArray: {},
      fieldGroup: [{ id: 'field-0' }, { id: 'field-1' }],
      model: ['alpha', 'beta'],
      formControl: {
        length: 2,
        patchValue,
      },
    } as any;
    return { component, patchValue };
  }

  it('defers the manual model sync until after add completes', () => {
    const { component, patchValue } = createComponent();
    const addSpy = vi.spyOn(FieldArrayType.prototype, 'add').mockImplementation(function(this: any, index?: number, initialModel?: any) {
      const i = index == null ? this.field.fieldGroup.length : index;
      this.model.splice(i, 0, initialModel);
      this.field.fieldGroup.splice(i, 0, { id: `field-${i}` });
      this.field.formControl.length = this.model.length;
    });

    component.add(1);

    expect(addSpy).toHaveBeenCalledOnce();
    expect(patchValue).not.toHaveBeenCalled();

    addSpy.mockRestore();
  });

  it('removes blank inputs on blur', () => {
    const { component } = createComponent();
    const removeSpy = vi.spyOn(component, 'remove').mockImplementation(() => undefined);
    const event = {
      target: {
        tagName: 'INPUT',
        classList: { contains: () => false },
        value: '',
      },
    } as any;

    component.maybeRemove(event, 1);

    expect(removeSpy).toHaveBeenCalledWith(1);
  });

  it('keeps blank inputs on blur when keepBlank is set', () => {
    const { component } = createComponent();
    component.field.props = { keepBlank: true };
    const removeSpy = vi.spyOn(component, 'remove').mockImplementation(() => undefined);
    const event = {
      target: {
        tagName: 'INPUT',
        classList: { contains: () => false },
        value: '',
      },
    } as any;

    component.maybeRemove(event, 1);

    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('removes blank middle inputs on Backspace and Delete when keepBlank is set', () => {
    const { component } = createComponent();
    (component.field as any).model = ['alpha', '', 'gamma'];
    component.field.fieldGroup = [{ id: 'field-0' }, { id: 'field-1' }, { id: 'field-2' }];
    component.field.props = { keepBlank: true };
    const removeSpy = vi.spyOn(component, 'remove').mockImplementation(() => undefined);
    const focusSpy = vi.spyOn(component, 'focus').mockImplementation(() => undefined);
    const key = (key: string) => ({ key, shiftKey: false, repeat: false, preventDefault: vi.fn() }) as any;

    component.keydown(key('Backspace'), 1);
    expect(removeSpy).toHaveBeenLastCalledWith(1);
    expect(focusSpy).toHaveBeenLastCalledWith(0, true);

    component.keydown(key('Delete'), 1);
    expect(removeSpy).toHaveBeenCalledTimes(2);
    expect(focusSpy).toHaveBeenLastCalledWith(1, true);
  });

  describe('location seeding', () => {
    function createLocationList(values: any[], ring = false) {
      const component = new ListTypeComponent({ hotkey: false } as any);
      const formControl = { length: values.length, value: values } as any;
      component.field = {
        fieldArray: { type: 'location' },
        fieldGroup: values.map((_, i) => ({ id: `field-${i}` })),
        model: values,
        formControl,
      } as any;
      if (ring) closedRings.add(formControl);
      const addSpy = vi.spyOn(FieldArrayType.prototype, 'add').mockImplementation(() => undefined);
      return { component, addSpy };
    }

    afterEach(() => vi.restoreAllMocks());

    it('splits the closing edge of a closed ring', () => {
      const { component, addSpy } = createLocationList([[0, 10], [10, 10], [10, 0], [0, 10]], true);
      component.add();
      expect(addSpy).toHaveBeenCalledWith(3, [5, 5], undefined);
    });

    it('copies the previous point in an open list', () => {
      const { component, addSpy } = createLocationList([[1, 2], [3, 4]]);
      component.add();
      expect(addSpy).toHaveBeenCalledWith(undefined, [3, 4], undefined);
    });

    it('copies the next point when inserting first', () => {
      const { component, addSpy } = createLocationList([[1, 2], [3, 4]]);
      component.add(0);
      expect(addSpy).toHaveBeenCalledWith(0, [1, 2], undefined);
    });

    it('leaves the point unset without valid neighbours', () => {
      const { component, addSpy } = createLocationList([[0, 0]]);
      component.add();
      expect(addSpy).toHaveBeenCalledWith(undefined, undefined, undefined);
    });
  });

  describe('ring closure', () => {
    function createRing(values: any[]) {
      const component = new ListTypeComponent({ hotkey: false } as any);
      const formControl = new FormArray(values.map(v => new FormControl(v)));
      const model = [...values];
      component.field = {
        fieldArray: { type: 'location' },
        fieldGroup: values.map((_, i) => ({ id: `field-${i}` })),
        model,
        formControl,
        props: { ring: true },
      } as any;
      vi.spyOn(FieldArrayType.prototype, 'add').mockImplementation(function(this: any, index?: number, initialModel?: any) {
        const i = index ?? this.formControl.length;
        this.model.splice(i, 0, initialModel);
        this.formControl.insert(i, new FormControl(initialModel));
      });
      component.ngOnInit();
      return { component, formControl };
    }

    afterEach(() => vi.restoreAllMocks());

    it('mirrors an edited first position into the closing position', () => {
      const { component, formControl } = createRing([[0, 0], [1, 0], [1, 1], [0, 0]]);
      formControl.at(0).setValue([2, 2]);
      (component as any).closeRing();
      expect(formControl.value).toEqual([[2, 2], [1, 0], [1, 1], [2, 2]]);
      component.ngOnDestroy();
    });

    it('appends a closing position when the whole ring is replaced', () => {
      const { component, formControl } = createRing([[0, 0], [1, 0], [1, 1], [0, 0]]);
      formControl.setValue([[0, 0], [1, 0], [1, 1], [0, 1]]);
      (component as any).closeRing();
      expect(formControl.value).toEqual([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]);
      expect(closedRings.has(formControl)).toBe(true);
      component.ngOnDestroy();
    });
  });
});
