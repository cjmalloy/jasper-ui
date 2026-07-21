import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyFieldProps } from '@ngx-formly/core';
import { EditorComponent } from '../form/editor/editor.component';

interface EditorProps extends FormlyFieldProps {
  addButton?: boolean;
  addCommentTitle?: string;
  addCommentLabel?: string;
  bubble?: boolean;
}

@Component({
  selector: 'formly-field-editor',
  host: { 'class': 'field editor-field' },
  template: `
    <div #fillWidth class="fill-editor">
      <app-editor [id]="id"
                  [control]="editorControl"
                  [hasTags]="false"
                  [addButton]="!!props.addButton"
                  [addCommentTitle]="addCommentTitle"
                  [addCommentLabel]="addCommentLabel"
                  [fillWidth]="fillWidth"
                  [class.bubble]="props.bubble"></app-editor>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditorComponent],
})
export class FormlyFieldEditor extends FieldType<FieldTypeConfig<EditorProps>> {
  get editorControl() {
    return this.formControl as UntypedFormControl;
  }

  get addCommentTitle() {
    return this.props.addCommentTitle ?? $localize`Add comment`;
  }

  get addCommentLabel() {
    return this.props.addCommentLabel ?? $localize`+ Add comment`;
  }
}
