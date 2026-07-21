import { FormlyConfig, FormlyFieldConfig } from '@ngx-formly/core';
import { isObject } from 'lodash-es';

export function getErrorMessage(field: FormlyFieldConfig, config: FormlyConfig) {
    const fieldForm = field.formControl!;
    for (const error in fieldForm.errors) {
      if (!fieldForm.errors.hasOwnProperty(error)) continue;
      let message = config.getValidatorMessage(error);
      if (isObject(fieldForm.errors[error])) {
        const e = fieldForm.errors[error] as any;
        if (e.errorPath) {
          return '';
        }
        if (e.message) {
          message = e.message;
        }
      }
      if (field.validation?.messages?.[error]) {
        message = field.validation.messages[error];
      }
      if (field.validators?.[error]?.message) {
        message = field.validators[error].message;
      }
      if (field.asyncValidators?.[error]?.message) {
        message = field.asyncValidators[error].message;
      }
      if (typeof message === 'function') {
        return message(fieldForm.errors[error], field) as string;
      }
      return message;
    }
    return '';
}
