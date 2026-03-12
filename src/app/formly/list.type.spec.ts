/// <reference types="vitest/globals" />
import { FieldArrayType } from '@ngx-formly/core';
import { vi } from 'vitest';
import { ListTypeComponent } from './list.type';

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

  it('defers the manual model sync until after add completes', async () => {
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

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(patchValue).toHaveBeenCalledWith(component.model, { emitEvent: true });

    addSpy.mockRestore();
  });

  it('ignores blur-based removal while the list is being structurally updated', async () => {
    const { component } = createComponent();
    const addSpy = vi.spyOn(FieldArrayType.prototype, 'add').mockImplementation(function(this: any, index?: number, initialModel?: any) {
      const i = index == null ? this.field.fieldGroup.length : index;
      this.model.splice(i, 0, initialModel);
      this.field.fieldGroup.splice(i, 0, { id: `field-${i}` });
      this.field.formControl.length = this.model.length;
    });
    const removeSpy = vi.spyOn(component, 'remove').mockImplementation(() => undefined);
    const event = {
      target: {
        tagName: 'INPUT',
        classList: { contains: () => false },
        value: '',
      },
    } as any;

    component.add(1);
    component.maybeRemove(event, 1);

    expect(removeSpy).not.toHaveBeenCalled();

    await new Promise(resolve => setTimeout(resolve, 10));
    component.maybeRemove(event, 1);

    expect(removeSpy).toHaveBeenCalledWith(1);

    addSpy.mockRestore();
  });
});
