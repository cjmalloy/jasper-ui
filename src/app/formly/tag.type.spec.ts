/// <reference types="vitest/globals" />
import { of } from 'rxjs';
import { vi } from 'vitest';
import { FormlyFieldTagInput } from './tag.type';

describe('FormlyFieldTagInput', () => {
  function createComponent(prefix = '') {
    const editor = {
      getTagPreview: vi.fn().mockReturnValue(of({ tag: '+plugin/secret/custom', name: 'Preview' })),
    };
    const component = new FormlyFieldTagInput(
      { base: '/' } as any,
      {} as any,
      { searchPlugins: () => [], searchTemplates: () => [] } as any,
      editor as any,
      { page: () => of({ page: { totalElements: 0 }, content: [] }) } as any,
      { account: { origin: '' }, hotkey: false } as any,
      { detectChanges: vi.fn() } as any,
    );
    const setValue = vi.fn();
    component.field = {
      type: 'tag',
      props: prefix ? { prefix } : {},
      formControl: {
        value: '',
        setValue,
        valueChanges: of(''),
      },
    } as any;
    return { component, editor, setValue };
  }

  it('shows the suffix when the model value already includes the prefix', () => {
    const { component } = createComponent('a/b');

    component.field.formControl.value = 'a/b/c';

    expect(component.inputValue).toBe('c');
  });

  it('stores the prefixed value when the user types a suffix', () => {
    const { component, setValue } = createComponent('a/b');
    const search = vi.fn();
    component.search = search as any;

    component.onInput('c');

    expect(setValue).toHaveBeenCalledWith('a/b/c');
    expect(search).toHaveBeenCalledWith('c');
  });

  it('loads the preview for the prefixed value', () => {
    const { component, editor } = createComponent('+plugin/secret');

    component.getPreview('custom');

    expect(editor.getTagPreview).toHaveBeenCalledWith('+plugin/secret/custom', '', false, true, true);
    expect(component.preview).toBe('Preview');
  });
});
