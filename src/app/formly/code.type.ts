import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyAttributes, FormlyFieldProps } from '@ngx-formly/core';
import { autorun, IReactionDisposer } from 'mobx';
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
                         [options]="editorOptions"
                         [formlyAttributes]="field"
                         [style.width]="'min(900px, 50vw)'"
                         [style.height]="'min(300px, 90vh)'"
                         appResizeHandle
                         [hitArea]="config.mobile ? 48 : 20"></ngx-monaco-editor>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FormlyAttributes,
    MonacoEditorModule,
    ResizeHandleDirective,
  ],
})
export class FormlyFieldCode extends FieldType<FieldTypeConfig<CodeProps>> implements OnDestroy {

  private disposers: IReactionDisposer[] = [];
  private dark = false;

  constructor(
    public config: ConfigService,
    private store: Store,
    private cd: ChangeDetectorRef,
  ) {
    super();
    this.disposers.push(autorun(() => {
      this.dark = store.darkTheme;
      this.cd.markForCheck();
    }));
  }

  get editorOptions() {
    const language = this.props.language || 'javascript';
    const theme = this.dark ? 'vs-dark' : 'vs';
    if (this._options?.language !== language || this._options?.theme !== theme) {
      this._options = {
        language,
        theme,
        automaticLayout: true,
      };
    }
    return this._options;
  }
  private _options?: any;

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }
}
