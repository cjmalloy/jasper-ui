import { ChangeDetectionStrategy, Component, effect, input, signal, untracked } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { ResizeHandleDirective } from '../../directive/resize-handle.directive';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-code',
  templateUrl: './code.component.html',
  styleUrls: ['./code.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MonacoEditorModule, ResizeHandleDirective]
})
export class CodeComponent {

  readonly group = input.required<UntypedFormGroup>();
  readonly fieldName = input('source');

  readonly options = signal<any>({
    language: 'css',
    automaticLayout: true,
  });

  constructor(
    public config: ConfigService,
    private store: Store,
  ) {
    effect(() => {
      const theme = store.darkTheme ? 'vs-dark' : 'vs';
      this.options.set({
        ...untracked(() => this.options()),
        theme,
        language: this.language(),
      })
    });
  }



  readonly language = input('css');

}
