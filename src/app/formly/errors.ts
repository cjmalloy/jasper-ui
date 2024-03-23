import { FormlyConfig } from '@ngx-formly/core';
import { FormlyFieldConfig } from '@ngx-formly/core/lib/models';
import { isObject } from 'lodash-es';

export function getErrorMessage(field: FormlyFieldConfig, config: FormlyConfig) {
    const fieldForm = field.formControl!;
    for (const error in fieldForm.errors) {
      if (!fieldForm.errors.hasOwnProperty(error)) continue;
      let message = config.getValidatorMessage(error);
      if (isObject(fieldForm.errors[error])) {
        if (fieldForm.errors[error].errorPath) {
          return '';
        }
        if (fieldForm.errors[error].message) {
          message = fieldForm.errors[error].message;
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
