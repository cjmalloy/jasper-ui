import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyAttributes, FormlyFieldProps } from '@ngx-formly/core';
import { FormlyFieldSelectProps, FormlySelectModule } from '@ngx-formly/core/select';

interface SelectProps extends FormlyFieldProps, FormlyFieldSelectProps {
  multiple?: boolean;
  compareWith?: (o1: any, o2: any) => boolean;
}

@Component({
  selector: 'formly-field-select',
  host: { 'class': 'field' },
  template: `
    @if (props.multiple) {
      <select multiple
              [formControl]="formControl"
              [compareWith]="props.compareWith!"
              [class.is-invalid]="showError"
              [formlyAttributes]="field">
        @if (props.options | formlySelectOptions: field | async; as opts) {
          @for (opt of opts; track opt) {
            @if (!opt.group) {
              <option [ngValue]="opt.value" [disabled]="opt.disabled">{{ opt.label }}</option>
            } @else {
              <optgroup [label]="opt.label">
                @for (child of opt.group; track child.value) {
                  <option [ngValue]="child.value" [disabled]="child.disabled">{{ child.label }}</option>
                }
              </optgroup>
            }
          }
        }
      </select>
    } @else {
      <select [formControl]="formControl"
              [compareWith]="props.compareWith!"
              [class.is-invalid]="showError"
              [formlyAttributes]="field">
        @if (props.placeholder) {
          <option [ngValue]="undefined">{{ props.placeholder }}</option>
        }
        @if (props.options | formlySelectOptions: field | async; as opts) {
          @for (opt of opts; track opt) {
            @if (!opt.group) {
              <option [ngValue]="opt.value" [disabled]="opt.disabled">{{ opt.label }}</option>
            } @else {
              <optgroup [label]="opt.label">
                @for (child of opt.group; track child.value) {
                  <option [ngValue]="child.value" [disabled]="child.disabled">{{ child.label }}</option>
                }
              </optgroup>
            }
          }
        }
      </select>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AsyncPipe,
    FormlySelectModule,
    FormlyAttributes,
  ],
})
export class FormlyFieldSelect extends FieldType<FieldTypeConfig<SelectProps>> {
  override defaultOptions = {
    props: {
      compareWith(o1: any, o2: any) {
        return o1 === o2;
      },
    },
  };
}
