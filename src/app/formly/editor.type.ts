import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldType, FieldTypeConfig } from '@ngx-formly/core';
import { EditorComponent } from '../form/editor/editor.component';

@Component({
  selector: 'formly-field-editor',
  host: { 'class': 'field editor-field' },
  template: `
    <app-editor [id]="id"
                [control]="$any(formControl)"
                [hasTags]="false"></app-editor>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditorComponent],
})
export class FormlyFieldEditor extends FieldType<FieldTypeConfig> { }
