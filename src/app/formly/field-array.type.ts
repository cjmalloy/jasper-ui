import { Directive } from '@angular/core';
import { FieldArrayType, FieldArrayTypeConfig, FormlyFieldConfig, ɵdefineHiddenProp, ɵhasKey } from '@ngx-formly/core';

/**
 * Formly clears the fields registered on every control of a form when
 * another formly-form sharing that form gets new fields, but
 * FieldArrayType.add() and remove() look this field up there.
 * Register it again before changing the array.
 */
@Directive()
export abstract class JasperFieldArrayType<F extends FormlyFieldConfig = FieldArrayTypeConfig> extends FieldArrayType<F> {

  override add(i?: number, initialModel?: any, options?: { markAsDirty: boolean }) {
    this.registerField();
    super.add(i, initialModel, options);
  }

  override remove(i: number, options?: { markAsDirty: boolean }) {
    this.registerField();
    super.remove(i, options);
  }

  private registerField() {
    const control: any = this.field.formControl;
    if (!control || !ɵhasKey(this.field)) return;
    if (!control._fields) ɵdefineHiddenProp(control, '_fields', []);
    if (!control._fields.includes(this.field)) control._fields.push(this.field);
  }
}
