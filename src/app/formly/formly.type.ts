import { ConfigOption, FieldArrayType, FormlyFieldConfig } from '@ngx-formly/core';

type TypeOption = NonNullable<ConfigOption['types']>[number];

/**
 * Field types which use the options prop.
 */
export const OPTIONS_TYPES = ['select', 'enum', 'radio', 'multicheckbox'];

/**
 * Field types which need props the form builder can't set, such as the parent plugin.
 */
const SKIP_TYPES = ['child-plugin', 'userMap'];

/**
 * Groups of field types shown in the form builder, with translated names.
 * Types not listed here are shown by name in the Other group.
 */
export function typeGroups(): [string, [string, string][]][] {
  return [
    [$localize`Text`, [
      ['string', $localize`Text`],
      ['input', $localize`Input`],
      ['textarea', $localize`Text Area`],
      ['editor', $localize`Markdown Editor`],
      ['code', $localize`Code`],
      ['email', $localize`Email`],
      ['tel', $localize`Phone Number`],
      ['color', $localize`Color`],
    ]],
    [$localize`Numbers`, [
      ['number', $localize`Number`],
      ['integer', $localize`Integer`],
      ['range', $localize`Slider`],
      ['duration', $localize`Duration`],
    ]],
    [$localize`Date and Time`, [
      ['date', $localize`Date`],
      ['time', $localize`Time`],
      ['datetime', $localize`Date and Time`],
      ['week', $localize`Week`],
      ['month', $localize`Month`],
    ]],
    [$localize`Choices`, [
      ['boolean', $localize`Boolean`],
      ['checkbox', $localize`Checkbox`],
      ['multicheckbox', $localize`Checkboxes`],
      ['radio', $localize`Radio Buttons`],
      ['select', $localize`Dropdown`],
      ['enum', $localize`Enum`],
    ]],
    [$localize`Links`, [
      ['url', $localize`URL`],
      ['urls', $localize`URLs`],
      ['ref', $localize`Ref`],
      ['refs', $localize`Refs`],
      ['image', $localize`Image`],
      ['video', $localize`Video`],
      ['audio', $localize`Audio`],
      ['pdf', $localize`PDF`],
      ['qr', $localize`QR Code`],
    ]],
    [$localize`Tags`, [
      ['tag', $localize`Tag`],
      ['tags', $localize`Tags`],
      ['qtag', $localize`Qualified Tag`],
      ['qtags', $localize`Qualified Tags`],
      ['selector', $localize`Tag Selector`],
      ['selectors', $localize`Tag Selectors`],
      ['tagOriginSelector', $localize`Tag or Origin Selector`],
      ['tagOriginSelectors', $localize`Tag or Origin Selectors`],
      ['plugin', $localize`Plugin`],
      ['template', $localize`Template`],
      ['stencil', $localize`Stencil`],
      ['query', $localize`Query`],
      ['queries', $localize`Queries`],
      ['bookmark', $localize`Bookmark`],
      ['bookmarks', $localize`Bookmarks`],
    ]],
    [$localize`Users and Origins`, [
      ['user', $localize`User`],
      ['users', $localize`Users`],
      ['quser', $localize`Qualified User`],
      ['qusers', $localize`Qualified Users`],
      ['origin', $localize`Origin`],
      ['originSelector', $localize`Origin Selector`],
      ['originSelectorList', $localize`Origin Selectors`],
    ]],
    [$localize`Map`, [
      ['location', $localize`Location`],
      ['bbox', $localize`Bounding Box`],
      ['geometries', $localize`Features (Points, Lines, Polygons)`],
      ['geo-style', $localize`Map Style`],
    ]],
    [$localize`Other`, [
      ['formly', $localize`Form`],
    ]],
  ];
}

/**
 * Options for the builder type select, grouped and with translated names.
 */
export function typeOptions(names: string[]): { value: string, label: string, group: string }[] {
  const groups = typeGroups();
  const other = groups[groups.length - 1][0];
  const known = groups.flatMap(([group, types]) => types
    .filter(([name]) => names.includes(name))
    .map(([value, label]) => ({ value, label, group })));
  const unknown = names
    .filter(n => !known.some(o => o.value === n))
    .sort()
    .map(value => ({ value, label: value, group: other }));
  return [...known, ...unknown];
}

/**
 * Field types which have the form-field wrapper, but ignore the placeholder.
 */
const NO_PLACEHOLDER_TYPES = ['range', 'checkbox', 'radio', 'multicheckbox', 'location', 'bbox', 'code'];

/**
 * How a field type is rendered, to show only the builder options it uses.
 */
export interface BuilderType {
  /** The type and every type it extends, most specific first. */
  chain: string[];
  /** Wrapped in the form-field wrapper, which renders the label, hint and required marker. */
  formField: boolean;
  /** A field array, such as a list, which renders its own label. */
  list: boolean;
}

/**
 * Type info for each registered type, and the formly builder type itself.
 */
export function builderTypes(types: TypeOption[]): Map<string, BuilderType> {
  const byName = new Map(types.map(t => [t.name, t]));
  const result = new Map<string, BuilderType>();
  for (const type of [...types, { name: 'formly', extends: 'list' } as TypeOption]) {
    const chain: string[] = [];
    let wrappers: string[] | undefined;
    let component: any;
    for (let t: TypeOption | undefined = type; t && !chain.includes(t.name); t = t.extends ? byName.get(t.extends) : undefined) {
      chain.push(t.name);
      wrappers ??= t.wrappers;
      component ??= t.component;
    }
    const list = chain.includes('list') || component?.prototype instanceof FieldArrayType;
    result.set(type.name, { chain, formField: !!wrappers?.includes('form-field'), list });
  }
  return result;
}

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
  return types.map(t => t.name).filter(t => !SKIP_TYPES.includes(t) && (!isList(t) || hasFieldArray(t)));
}

/**
 * Formly type for editing a list of formly field configs, so formly forms
 * can be built in the UI. Field config properties not shown in the
 * builder are kept as is.
 * Fields without a type are groups, which can contain nested fields.
 */
export function formlyType(types: TypeOption[]): TypeOption {
  const typeNames = builderTypeNames(types);
  const info = builderTypes(types);
  /** Type of the field being edited. */
  const typeOf = (field: FormlyFieldConfig): string | undefined => field.parent?.model?.type;
  /** Type info of the field being edited, if it has a known type. */
  const infoOf = (field: FormlyFieldConfig) => info.get(typeOf(field)!);
  const isType = (field: FormlyFieldConfig, ...names: string[]) => names.some(n => !!infoOf(field)?.chain.includes(n));
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
            options: typeOptions([...typeNames, 'formly']),
          },
        }, {
          key: 'props.label',
          type: 'string',
          parsers: [omitEmpty],
          className: 'formly-label',
          expressions: {
            hide: (field: FormlyFieldConfig) => !!infoOf(field) && !infoOf(field)!.formField && !infoOf(field)!.list,
          },
          props: {
            label: $localize`Label:`,
          },
        }, {
          key: 'props.placeholder',
          type: 'string',
          parsers: [omitEmpty],
          className: 'formly-placeholder',
          expressions: {
            hide: (field: FormlyFieldConfig) => !typeOf(field) || typeOf(field) === 'stencil'
              || !!infoOf(field) && (!infoOf(field)!.formField || isType(field, ...NO_PLACEHOLDER_TYPES)),
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
            hide: (field: FormlyFieldConfig) => !typeOf(field) || !!infoOf(field) && !infoOf(field)!.formField,
          },
          props: {
            label: $localize`Hint:`,
          },
        }, {
          key: 'props.required',
          type: 'boolean',
          className: 'formly-required',
          expressions: {
            hide: (field: FormlyFieldConfig) => !typeOf(field) || !!infoOf(field) && !infoOf(field)!.formField,
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
          key: 'props.multiple',
          type: 'boolean',
          className: 'formly-multiple',
          expressions: {
            hide: (field: FormlyFieldConfig) => !isType(field, 'select'),
          },
          props: {
            label: $localize`Multiple:`,
          },
        }, {
          key: 'props.type',
          type: 'select',
          className: 'formly-multicheckbox-type',
          expressions: {
            hide: (field: FormlyFieldConfig) => stashArrayType(field, !isType(field, 'multicheckbox')),
          },
          props: {
            label: $localize`Values:`,
            placeholder: $localize`Object`,
            options: [{ value: 'array', label: $localize`Array` }],
          },
        }, {
          key: 'props.min',
          type: 'number',
          parsers: [omitEmpty],
          className: 'formly-min',
          expressions: {
            hide: (field: FormlyFieldConfig) => !isType(field, 'range'),
          },
          props: {
            label: $localize`Min:`,
            placeholder: '0',
          },
        }, {
          key: 'props.max',
          type: 'number',
          parsers: [omitEmpty],
          className: 'formly-max',
          expressions: {
            hide: (field: FormlyFieldConfig) => !isType(field, 'range'),
          },
          props: {
            label: $localize`Max:`,
            placeholder: '10',
          },
        }, {
          key: 'props.step',
          type: 'number',
          parsers: [omitEmpty],
          className: 'formly-step',
          expressions: {
            hide: (field: FormlyFieldConfig) => !isType(field, 'range'),
          },
          props: {
            label: $localize`Step:`,
            placeholder: '1',
          },
        }, {
          key: 'props.language',
          type: 'string',
          parsers: [omitEmpty],
          className: 'formly-language',
          expressions: {
            hide: (field: FormlyFieldConfig) => !isType(field, 'code'),
          },
          props: {
            label: $localize`Language:`,
            placeholder: 'javascript',
          },
        }, {
          key: 'props.rows',
          type: 'integer',
          parsers: [omitEmpty],
          className: 'formly-rows',
          expressions: {
            hide: (field: FormlyFieldConfig) => !isType(field, 'textarea'),
          },
          props: {
            label: $localize`Rows:`,
            placeholder: '1',
            min: 1,
          },
        }, {
          key: 'props.prefix',
          type: 'string',
          parsers: [omitEmpty],
          className: 'formly-prefix',
          expressions: {
            // Plugin and template suggestions are not loaded with a query
            hide: (field: FormlyFieldConfig) => !isType(field, 'tag', 'query', 'bookmark') || isType(field, 'plugin', 'template'),
          },
          props: {
            label: $localize`Prefix:`,
            hint: $localize`Query used to filter suggestions.`,
          },
        }, {
          key: 'props.template',
          type: 'string',
          className: 'formly-template',
          expressions: {
            hide: (field: FormlyFieldConfig) => field.parent?.model?.type !== 'stencil',
          },
          props: {
            label: $localize`Template:`,
            placeholder: $localize`prefix/<Label>`,
            hint: $localize`A tag with an input for each <Placeholder>. Commas in the first part make a dropdown, such as +plugin,_plugin/secret/<Name>.`,
          },
        }, {
          key: 'props.hierarchical',
          type: 'boolean',
          className: 'formly-hierarchical',
          expressions: {
            hide: (field: FormlyFieldConfig) => field.parent?.model?.type !== 'stencil',
          },
          props: {
            label: $localize`Hierarchical:`,
            hint: $localize`One labelled line per placeholder, filled out top down. The value is the tag up to each line.`,
          },
        }, {
          key: 'fieldGroup',
          type: 'formly',
          className: 'formly-field-group',
          resetOnHide: true,
          expressions: {
            hide: hideFieldGroup,
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
 * Remove cleared values, so clearing a key or label doesn't leave an empty string.
 */
function omitEmpty(value: any) {
  return value === '' || value === null ? undefined : value;
}

const hiddenArrayTypes = new WeakSet<object>();

/**
 * Remove the multicheckbox array value type when the field gets another
 * type, since other types use props.type for the input type. Changing
 * back restores it.
 */
function stashArrayType(field: FormlyFieldConfig, hide: boolean) {
  const model = field.parent?.model;
  if (!model) return hide;
  if (hide && model.props?.type === 'array') {
    hiddenArrayTypes.add(model);
    delete model.props.type;
  } else if (!hide && hiddenArrayTypes.has(model)) {
    (model.props ??= {}).type = 'array';
    hiddenArrayTypes.delete(model);
  }
  return hide;
}

const hiddenFieldGroups = new WeakMap<object, any>();

/**
 * Hide nested fields when a group gets a type, since a typed field with a
 * field group would get a FormGroup instead of a FormControl.
 * The nested fields are removed from the config, but kept in the editor so
 * changing back to a group restores them.
 */
function hideFieldGroup(field: FormlyFieldConfig) {
  const model = field.parent?.model;
  if (!model) return false;
  const hide = !!model.type;
  if (hide && model.fieldGroup) {
    hiddenFieldGroups.set(model, model.fieldGroup);
  } else if (!hide && !model.fieldGroup && hiddenFieldGroups.has(model)) {
    model.fieldGroup = hiddenFieldGroups.get(model);
    hiddenFieldGroups.delete(model);
  }
  return hide;
}

/**
 * Keep values of hidden fields, so changing the type of a field in the
 * builder doesn't delete its options or nested fields.
 */
function keepHidden(field: FormlyFieldConfig): FormlyFieldConfig {
  field.resetOnHide ??= false;
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
