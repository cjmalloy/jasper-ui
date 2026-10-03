import { controlValue } from '../../util/form';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { isEqual } from 'lodash-es';
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
  private readonly rootControlState = controlValue(() => this.group());


  readonly group = input.required<UntypedFormGroup>();
  readonly fieldName = input('source');

  readonly options = computed(() => ({
    language: this.language(),
    automaticLayout: true,
    theme: this.store.darkTheme() ? 'vs-dark' : 'vs',
  }), { equal: isEqual });

  constructor(
    public config: ConfigService,
    private store: Store,
  ) { }

  readonly language = input('css');

}
