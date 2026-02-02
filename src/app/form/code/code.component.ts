import { ChangeDetectionStrategy, Component, effect, inject, Input, input } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { ResizeHandleDirective } from '../../directive/resize-handle.directive';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-code',
  templateUrl: './code.component.html',
  styleUrls: ['./code.component.scss'],
  imports: [ReactiveFormsModule, MonacoEditorModule, ResizeHandleDirective]
})
export class CodeComponent {
  config = inject(ConfigService);
  private store = inject(Store);


  @Input()
  group!: UntypedFormGroup;
  readonly fieldName = input('source');

  options: any = {
    language: 'css',
    automaticLayout: true,
  };

  constructor() {
    const store = this.store;

    effect(() => {
      this.options = {
        ...this.options,
        theme: store.darkTheme ? 'vs-dark' : 'vs',
      }
    });
  }

  @Input()
  set language(value: string) {
    this.options = {
      ...this.options,
      language: value,
    }
  }
}
