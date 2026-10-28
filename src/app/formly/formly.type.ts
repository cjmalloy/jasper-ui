import { ConfigOption, FormlyFieldConfig } from '@ngx-formly/core';

type TypeOption = NonNullable<ConfigOption['types']>[number];

/**
 * Field types which use the options prop.
 */
export const OPTIONS_TYPES = ['select', 'enum', 'radio', 'multicheckbox'];

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
      fieldArray: {
        wrappers: ['form-group'],
        className: 'formly-field-config',
        fieldGroup: [{
          key: 'key',
          type: 'string',
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
          className: 'formly-label',
          props: {
            label: $localize`Label:`,
          },
        }, {
          key: 'props.placeholder',
          type: 'string',
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
      },
    },
  };
}

/**
 * Admin form for building the formly forms in a Plugin or Template config.
 */
export function formBuilderFields(): FormlyFieldConfig[] {
  return [{
    key: 'form',
    type: 'formly',
    props: {
      label: $localize`Form:`,
    },
  }, {
    key: 'advancedForm',
    type: 'formly',
    props: {
      label: $localize`Advanced Form:`,
    },
  }, {
    key: 'adminForm',
    type: 'formly',
    props: {
      label: $localize`Admin Form:`,
    },
  }, {
    key: 'advancedAdminForm',
    type: 'formly',
    props: {
      label: $localize`Advanced Admin Form:`,
    },
  }];
}
