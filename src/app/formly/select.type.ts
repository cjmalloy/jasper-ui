import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldType, FieldTypeConfig, FormlyFieldProps } from '@ngx-formly/core';
import { FormlyFieldSelectProps } from '@ngx-formly/core/select';

interface SelectProps extends FormlyFieldProps, FormlyFieldSelectProps {
  multiple?: boolean;
  compareWith?: (o1: any, o2: any) => boolean;
}

@Component({
  standalone: false,
  selector: 'formly-field-select',
  template: `
    <select *ngIf="props.multiple; else singleSelect"
            multiple
            [formControl]="formControl"
            [compareWith]="props.compareWith!"
            [class.is-invalid]="showError"
            [formlyAttributes]="field">
      <ng-container *ngIf="props.options | formlySelectOptions: field | async as opts">
        <ng-container *ngFor="let opt of opts">
          <option *ngIf="!opt.group; else optgroup" [ngValue]="opt.value" [disabled]="opt.disabled">
            {{ opt.label }}
          </option>
          <ng-template #optgroup>
            <optgroup [label]="opt.label">
              <option *ngFor="let child of opt.group" [ngValue]="child.value" [disabled]="child.disabled">
                {{ child.label }}
              </option>
            </optgroup>
          </ng-template>
        </ng-container>
      </ng-container>
    </select>
    <ng-template #singleSelect>
      <select [formControl]="formControl"
              [compareWith]="props.compareWith!"
              [class.is-invalid]="showError"
              [formlyAttributes]="field">
        <option *ngIf="props.placeholder" [ngValue]="undefined">{{ props.placeholder }}</option>
        <ng-container *ngIf="props.options | formlySelectOptions: field | async as opts">
          <ng-container *ngFor="let opt of opts">
            <option *ngIf="!opt.group; else optgroup" [ngValue]="opt.value" [disabled]="opt.disabled">
              {{ opt.label }}
            </option>
            <ng-template #optgroup>
              <optgroup [label]="opt.label">
                <option *ngFor="let child of opt.group" [ngValue]="child.value" [disabled]="child.disabled">
                  {{ child.label }}
                </option>
              </optgroup>
            </ng-template>
          </ng-container>
        </ng-container>
      </select>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
