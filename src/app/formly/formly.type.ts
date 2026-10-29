import { ConfigOption, FormlyFieldConfig } from '@ngx-formly/core';

type TypeOption = NonNullable<ConfigOption['types']>[number];

/**
 * Field types which use the options prop.
 */
export const OPTIONS_TYPES = ['select', 'enum', 'radio', 'multicheckbox'];

/**
 * Names of the types which can be picked in the form builder.
 * List types without a field array are skipped, since the builder
 * can't edit the field array.
 */
export function builderTypeNames(types: TypeOption[]): string[] {
  const byName = new Map(types.map(t => [t.name, t]));
  const hasFieldArray = (name?: string, seen: string[] = []): boolean => {
    const t = name ? byName.get(name) : undefined;
    if (!t || seen.includes(t.name)) return false;
    if (t.defaultOptions?.fieldArray) return true;
    return hasFieldArray(t.extends, [...seen, t.name]);
  };
  const isList = (name?: string, seen: string[] = []): boolean => {
    const t = name ? byName.get(name) : undefined;
    if (!t || seen.includes(t.name)) return false;
    return t.name === 'list' || isList(t.extends, [...seen, t.name]);
  };
  return types.map(t => t.name).filter(t => !isList(t) || hasFieldArray(t));
}

/**
 * Formly type for editing a list of formly field configs, so formly forms
 * can be built in the UI. Field config properties not shown in the
 * builder are kept as is.
 * Fields without a type are groups, which can contain nested fields.
 */
export function formlyType(typeNames: string[]): TypeOption {
  return {
    name: 'formly',
    extends: 'list',
    defaultOptions: {
      props: {
        label: $localize`Form:`,
        addText: $localize`+ Add another field`,
      },
      fieldArray: keepHidden({
        className: 'formly-field-config',
        fieldGroup: [{
          key: 'key',
          type: 'string',
          parsers: [omitEmpty],
          className: 'formly-key',
          props: {
            label: $localize`Key:`,
          },
        }, {
          key: 'type',
          type: 'select',
          className: 'formly-type',
          props: {
            label: $localize`Type:`,
            placeholder: $localize`Group`,
            options: [...typeNames, 'formly'].sort().map(t => ({ value: t, label: t })),
          },
        }, {
          key: 'props.label',
          type: 'string',
          parsers: [omitEmpty],
          className: 'formly-label',
          props: {
            label: $localize`Label:`,
          },
        }, {
          key: 'props.placeholder',
          type: 'string',
          parsers: [omitEmpty],
          className: 'formly-placeholder',
          expressions: {
            hide: (field: FormlyFieldConfig) => !field.parent?.model?.type,
          },
          props: {
            label: $localize`Placeholder:`,
          },
        }, {
          key: 'props.hint',
          type: 'string',
          parsers: [omitEmpty],
          className: 'formly-hint',
          expressions: {
            hide: (field: FormlyFieldConfig) => !field.parent?.model?.type,
          },
          props: {
            label: $localize`Hint:`,
          },
        }, {
          key: 'props.required',
          type: 'boolean',
          className: 'formly-required',
          expressions: {
            hide: (field: FormlyFieldConfig) => !field.parent?.model?.type,
          },
          props: {
            label: $localize`Required:`,
          },
        }, {
          key: 'props.options',
          type: 'list',
          className: 'formly-options',
          expressions: {
            hide: (field: FormlyFieldConfig) => !OPTIONS_TYPES.includes(field.parent?.model?.type),
          },
          props: {
            label: $localize`Options:`,
            addText: $localize`+ Add another option`,
          },
          fieldArray: {
            fieldGroup: [{
              key: 'value',
              type: 'string',
              className: 'formly-option-value',
              props: {
                label: $localize`Value:`,
              },
            }, {
              key: 'label',
              type: 'string',
              className: 'formly-option-label',
              props: {
                label: $localize`Label:`,
              },
            }],
          },
        }, {
          key: 'fieldGroup',
          type: 'formly',
          className: 'formly-field-group',
          expressions: {
            hide: (field: FormlyFieldConfig) => !!field.parent?.model?.type,
          },
          props: {
            label: $localize`Fields:`,
          },
        }],
      }),
    },
  };
}

/**
 * Remove cleared text, so clearing a key or label doesn't leave an empty string.
 */
function omitEmpty(value: any) {
  return value === '' ? undefined : value;
}

/**
 * Keep values of hidden fields, so changing the type of a field in the
 * builder doesn't delete its options or nested fields.
 */
function keepHidden(field: FormlyFieldConfig): FormlyFieldConfig {
  field.resetOnHide = false;
  field.fieldGroup?.forEach(keepHidden);
  if (field.fieldArray) keepHidden(field.fieldArray as FormlyFieldConfig);
  return field;
}

/**
 * Admin form for building the formly forms in a Plugin or Template config.
 */
export function formBuilderFields(): FormlyFieldConfig[] {
  return [{
    key: 'form',
    type: 'formly',
    className: 'builder-form',
    props: {
      label: $localize`Form:`,
    },
  }, {
    key: 'advancedForm',
    type: 'formly',
    className: 'builder-advanced-form',
    props: {
      label: $localize`Advanced Form:`,
    },
  }, {
    key: 'adminForm',
    type: 'formly',
    className: 'builder-admin-form',
    props: {
      label: $localize`Admin Form:`,
    },
  }, {
    key: 'advancedAdminForm',
    type: 'formly',
    className: 'builder-advanced-admin-form',
    props: {
      label: $localize`Advanced Admin Form:`,
    },
  }];
}
