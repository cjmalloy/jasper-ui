/// <reference types="vitest/globals" />
import { FormlyFieldConfig } from '@ngx-formly/core';
import { GRID_CUSTOM_COLUMN_TYPES } from '../component/grid/grid-column-types';
import { gridTemplate } from './grid';

describe('gridTemplate', () => {
  it('should expose the custom grid column types in the grid mod form', () => {
    const form = gridTemplate.config?.form as FormlyFieldConfig[] | undefined;
    const fieldArray = form?.[0]?.fieldArray as FormlyFieldConfig | undefined;
    const typeField = fieldArray?.fieldGroup?.find((field: FormlyFieldConfig) => field.key === 'type');
    const options = (typeField?.props?.options as { value: string }[] | undefined)?.map(option => option.value);

    expect(options).toEqual([
      '',
      'text',
      'number',
      'boolean',
      'date',
      'dateString',
      'dateTime',
      'dateTimeString',
      ...GRID_CUSTOM_COLUMN_TYPES,
    ]);
  });
});
