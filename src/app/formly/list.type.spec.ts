/// <reference types="vitest/globals" />
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
});
