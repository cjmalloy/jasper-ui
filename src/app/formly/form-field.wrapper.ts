import { Component, HostBinding, Inject, Optional, ViewChild } from '@angular/core';
import { FieldWrapper, FormlyFieldConfig } from '@ngx-formly/core';
import { CDK_DRAG_PARENT, CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { defer } from 'lodash-es';

@Component({
  selector: 'formly-wrapper-form-field',
  template: `
    <label cdkDragHandle [attr.for]="id" class="form-label" [class.required]="props.required">
      {{ props.label || '' }}
    </label>
    <ng-template #fieldComponent></ng-template>
    <ng-container *ngIf="props.hint">
      <span><!-- Hint --></span>
      <div class="no-margin">
        <span class="hints">
          <ng-container *ngIf="field.type === 'duration' else defaultHint">
            Use time spans (HH:MM:SS) or ISO 8601 Durations&nbsp;
            <sup><a target="_blank" href="https://en.wikipedia.org/wiki/ISO_8601#Durations">help</a></sup>
          </ng-container>
          <ng-template #defaultHint>
            {{ props.hint }}
          </ng-template>
        </span>
      </div>
    </ng-container>
    <ng-container *ngIf="showError">
      <span><!-- Errors --></span>
      <formly-error [field]="field"></formly-error>
    </ng-container>
  `,
})
export class FormlyWrapperFormField extends FieldWrapper<FormlyFieldConfig> {
  @HostBinding('title')
  get title() {
    return this.props.title || '';
  }

  @ViewChild(CdkDragHandle) handle?: CdkDragHandle;

  constructor(@Optional() @Inject(CDK_DRAG_PARENT) public cdk: CdkDrag) {
    super();
  }

  ngAfterViewInit() {
    if (this.cdk) {
        // @ts-ignore
        this.cdk._handles.length = 1;
        // @ts-ignore
        this.cdk._handles._results = [this.handle];
        // @ts-ignore
        this.cdk._handles.changes.next();
    }
  }
}
