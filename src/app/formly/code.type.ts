import { Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyAttributes, FormlyFieldProps } from '@ngx-formly/core';
import { isEqual } from 'lodash-es';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { ResizeHandleDirective } from '../directive/resize-handle.directive';
import { ConfigService } from '../service/config.service';
import { Store } from '../store/store';

interface CodeProps extends FormlyFieldProps {
  /**
   * Monaco language id, such as javascript, python, css, html or json.
   */
  language?: string;
}

@Component({
  selector: 'formly-field-code',
  host: { 'class': 'field code-editor' },
  template: `
    @defer {
      <ngx-monaco-editor [formControl]="formControl"
                         [options]="editorOptions()"
                         [formlyAttributes]="field"
                         [style.width]="'min(900px, 50vw)'"
                         [style.height]="'min(300px, 90vh)'"
                         appResizeHandle
                         [hitArea]="config.mobile() ? 48 : 20" />
    }
  `,
  imports: [
    ReactiveFormsModule,
    FormlyAttributes,
    MonacoEditorModule,
    ResizeHandleDirective,
  ],
})
export class FormlyFieldCode extends FieldType<FieldTypeConfig<CodeProps>> {
  config = inject(ConfigService);
  private store = inject(Store);

  readonly editorOptions = computed(() => ({
    language: this.props.language || 'javascript',
    theme: this.store.darkTheme() ? 'vs-dark' : 'vs',
    automaticLayout: true,
  }), { equal: isEqual });
}
